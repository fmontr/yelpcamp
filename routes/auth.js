var express = require("express"),
    router  = express.Router(),
    passport = require("passport"),
    async = require("async"),
    nodemailer = require("nodemailer"),
    crypto = require("crypto")

var User = require("../models/user.js"),
    Campground = require("../models/campground.js"),
    Comment = require("../models/comment.js")


//ROOT
router.get('/', function(req, res){
    res.render('landing')
})


//*********
// AUTH ROUTES
//*********

//REGISTER ROUTES
//Show register form
router.get('/register', function(req, res) {
    res.render('register', {page:'register'})
})

//handle sign up logic
router.post('/register', function(req, res) {
    var newUser = new User({
        avatar:req.body.avatar,
        firstName:req.body.firstName,
        lastName:req.body.lastName,
        email:req.body.email,
        username:req.body.username,
    })
    //register() needs a User object and the password separated to hash it
    User.register(newUser, req.body.password, function(err, user){
        if(err || !user){
            console.log(err)
            req.flash('error', err.message)
            res.redirect('/register')
        }
        //if user was created with no errors then we use this method to login
        passport.authenticate('local')(req, res, function(){
            req.flash('success', 'Welcome to YelpCamp ' + user.username)
            res.redirect('/campgrounds')
        })
    })
})

//LOGIN ROUTES
router.get('/login', function(req, res) {
    var originUrl = req.headers.referer.replace('https://webdevbootcamp-drbrown.c9users.io', '')
    res.render('login', {page:'login', originUrl:originUrl})
})

router.post('/login', passport.authenticate('local', {
    //   successRedirect: '/campgrounds',
       failureRedirect: '/login',
    //   successFlash: 'You\'re logged in!',
       failureFlash: 'Please check your username and password'
}), function(req, res) {
    req.flash('success', 'You\'re logged in!')
    res.redirect(req.body.originUrl)
})


//LOGOUT ROUTES
router.get('/logout', function(req, res) {
    req.logout()
    req.flash('success', 'Successfully logged out')
    res.redirect('/campgrounds')
})

//forgot password form
router.get('/forgot', function(req, res) {
    res.render('forgot')
})

//creates token, updates user and sends rec email
router.post('/forgot', function(req, res, next){
    async.waterfall([
        function(done) {
            crypto.randomBytes(20, function(err, buf){
                var token = buf.toString('hex')
                done(err, token)
            })
        },
        function(token, done){
            User.findOne({email: req.body.email}, function(err, user){
                if(err || !user) {
                    req.flash('error', 'No account found for this email')
                    return res.redirect('/forgot')
                }
                
                user.resetPasswordToken = token
                user.resetPasswordExpires = Date.now() + 3600000
                user.save(function(err){
                    done(err, token, user)
                })
            })
        },
        function(token, user, done) {
          var smtpTransport = nodemailer.createTransport({
                service: 'Gmail', 
                auth: {
                  user: 'feliperodrigues0789@gmail.com',
                  pass: process.env.GMAILPW
                }
          });
          var mailOptions = {
            to: user.email,
            from: 'no-reply@yelpcamp.com',
            subject: 'YelpCamp Password Reset',
            text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
              'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
              'http://' + req.headers.host + '/reset/' + token + '\n\n' +
              'If you did not request this, please ignore this email and your password will remain unchanged.\n'
          };
          smtpTransport.sendMail(mailOptions, function(err) {
            console.log('mail sent');
            req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
            done(err, 'done');
          });
        }
    ], function(err){
        if(err) {return next(err)}
        res.redirect('/campgrounds')
    })
})

//reset password form
router.get('/reset/:token', function(req, res) {
    User.findOne({resetPasswordToken:req.params.token, resetPasswordExpires:{$gt:Date.now()}}, function(err, user){
        if(err || !user){
            console.log(user + 'Error: ' + err + ' *****')
            req.flash('error', 'Reset token is invalid or has expired.')
            return res.redirect('/forgot')
        }
        res.render('reset', {token:req.params.token})
    })
})

//checks new password, updates user info on db and sends a confirmation email
router.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (err || !user) {
          req.flash('error', 'Reset token is invalid or has expired.');
          return res.redirect('back');
        }
        if(req.body.password === req.body.confirm) {
          user.setPassword(req.body.password, function(err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.save(function(err) {
              req.logIn(user, function(err) {
                done(err, user);
              });
            });
          })
        } else {
            req.flash("error", "Passwords do not match.");
            return res.redirect('back');
        }
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: 'feliperodrigues0789@gmail.com',
          pass: process.env.GMAILPW
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'no-reply@yelpcamp.com',
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'Success! Your password has been changed.');
        done(err);
      });
    }
  ], function(err) {
    res.redirect('/campgrounds');
  });
});

//USER PROFILE
router.get('/users/:id', function(req, res) {
    User.findById(req.params.id, function(err, foundUser){
        if(err || !foundUser){
            req.flash('error', 'User not found')
            return res.redirect('back')
        }
        Campground.find().where('author.id').equals(foundUser._id).exec(function(err, campgrounds){
            if(err){
                console.log(err)
            }
            Comment.find().where('author.id').equals(foundUser._id).exec(function(err, comments){
            if(err){
                console.log(err)
            }
                res.render('users/show', {foundUser:foundUser, campgrounds:campgrounds, comments:comments})
            })
        })
    })
})

module.exports = router