require("dotenv").config()

var express        = require("express"),
    bodyParser     = require("body-parser"),
    mongoose       = require("mongoose"),
    passport       = require("passport"),
    localStrategy  = require("passport-local"),
    expressSession = require("express-session"),
    Campground     = require("./models/campground.js"),
    Comment        = require("./models/comment.js"),
    seedDB         = require("./seed.js"),
    User           = require("./models/user.js"),
    methodOverride = require("method-override"),
    flash          = require("connect-flash")

//requiring routes
var campgroundRoutes = require("./routes/campgrounds.js"),
    commentRoutes    = require("./routes/comments.js"),
    authRoutes       = require("./routes/auth.js")

//express related setup
var app = express()
// mongoose.connect('mongodb://localhost/yelp_camp_db')
// mongoose.connect('mongodb://usernodejs:Fmontr9900@ds113442.mlab.com:13442/yelpcampdb')
mongoose.connect(process.env.DATABASEURL)
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({extended: true}))
app.use(express.static(__dirname + '/public'))
app.use(methodOverride('_method'))
app.use(flash())

//help us populate DB easily while testing
// seedDB()

//Passport Setup + express-session
app.use(expressSession({
    secret: 'this can be anything we want',
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
passport.use(new localStrategy(User.authenticate()))
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

//requiring/using moment.js. Adding it to app.locals makes it 
//available for use in all view files via the variable named moment
app.locals.moment = require('moment');

//this is a middleware we defined to pass the {currentUser:req.user},
//{errorMessage:req.flash('error')} and {successMessage:req.flash('success')} 
//to all our routes at once and then to each respective ejs template, 
//avoiding repeating the same code on each one
app.use(function(req, res, next){
  res.locals.currentUser = req.user
  res.locals.errorMessage = req.flash('error')
  res.locals.successMessage = req.flash('success')
  next()
})
//tell express to use the routes (OBS.: the middleware above must be declared
//first so when express uses the routes they have the variables linked already)
app.use(campgroundRoutes)
app.use(commentRoutes)
app.use(authRoutes)


//SERVER
app.listen(process.env.PORT, process.env.IP, () => console.log('SERVER UP'))