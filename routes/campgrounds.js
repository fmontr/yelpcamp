var express = require("express")
var router = express.Router()
var Campground = require("../models/campground.js")
//should be ../middleware/index.js - but index is a special name, and if not
//specified it will look into the index file
var middleware = require("../middleware")
var NodeGeocoder = require('node-geocoder')
var multer = require('multer');
var cloudinary = require('cloudinary');

//multer config
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({storage: storage, fileFilter: imageFilter})

//cloudinary config
cloudinary.config({ 
  cloud_name: 'dtclyfv6y', 
  api_key: '645512194495226', 
  api_secret: process.env.CLOUDINARY_API_SECRET
});


//config for NodeGeocoder
var options = {
  provider: 'google',
  httpAdapter: 'https',
  //put the sensitive API key on the .env file to hide it since it does not have
  //restrictions (HTTP referrers - otherwise an error will occur) - this key is
  //not disclosed to the browser, is used on server only.
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};
 
var geocoder = NodeGeocoder(options);


//INDEX
router.get('/campgrounds', function(req, res){
    var perPage = 8;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    var noMatch = null;
    //If there is an input on the search box
    if(req.query.search){
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        Campground.find({name: regex}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function(err, campgrounds){
            Campground.count({name: regex}).exec(function (err, count){
                if(err){
                console.log(err)
                res.redirect('back')
                } else {
                    if(campgrounds.length < 1) {
                            noMatch = "No campgrounds match that query, please try again.";
                    }
                    res.render("campgrounds/index", {
                        campgrounds: campgrounds,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        noMatch: noMatch,
                        search: req.query.search,
                        page: 'campgrounds'
                    });
                } 
            })
        })  
    } else {
        //If there's no search, then show all campgrounds from db
        Campground.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
            Campground.count().exec(function (err, count) {
                if (err) {
                    console.log(err);
                } else {
                    res.render("campgrounds/index", {
                        campgrounds: allCampgrounds,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        noMatch: noMatch,
                        search: false,
                        page: 'campgrounds'
                    });
                }
            });
        }); 
    }
})


//NEW
router.get('/campgrounds/new', middleware.isLoggedIn, function(req, res){
    res.render('campgrounds/new')
})


//CREATE
router.post('/campgrounds', middleware.isLoggedIn, upload.single('image'), function(req, res){
    geocoder.geocode(req.body.campground.location, function(err, data){
        if(err || !data.length){
            console.log('ERROR OCURRED ====> ' + err)
            req.flash('error', 'Invalid Address')
            return res.redirect('back')
        }
        req.body.campground.lat = data[0].latitude
        req.body.campground.lng = data[0].longitude
        req.body.campground.location = data[0].formattedAddress
        
        //upload image to Cloudinary servers
        cloudinary.v2.uploader.upload(req.file.path, function(err, result) {
          if(err) {
            req.flash('error', err.message);
            return res.redirect('back');
          }
          // add cloudinary url for the image to the campground object under image property
          req.body.campground.image = result.secure_url;
          // add image's public_id to campground object
          req.body.campground.imageId = result.public_id;
          
          //add author info to object
          req.body.campground.author = {id:req.user._id, username:req.user.username}
          
        // name, price, description are already formatted on req.body.campgound 
        // obj, ready to be sent to DB
            
            //create a new object on db
            Campground.create(req.body.campground, function(err, campground){
                if(err){
                    console.log(err)
                } else {
                    req.flash('success', 'Campground successfully created');
                    res.redirect('/campgrounds')
                }
            })
        });
    })
})


//SHOW
router.get('/campgrounds/:id', function(req, res) {
    Campground.findById(req.params.id).populate('comments').exec(function(err, foundCampground){
        if(err || !foundCampground){
            console.log(err)
            req.flash('error', 'Campground not found')
            res.redirect('/campgrounds')
        } else {
            res.render('campgrounds/show', {foundCampground : foundCampground})
        }
    })
})


//EDIT FORM
router.get('/campgrounds/:id/edit', middleware.checkCampgroundOwnership, function(req, res){
    Campground.findById(req.params.id, function(err, foundCampground){
        if(err || !foundCampground){
            console.log('ERROR OCURRED =======>' + err)
            req.flash('error', 'Campground not found')
            res.redirect('/campgrounds')
        } else {
            res.render('campgrounds/edit', {foundCampground:foundCampground})
        }
    })
})

//NOTE THAT ASYNC ONLY WORKS ON NEWER VERSIONS OF NODE (v8+) ***

//UPDATE
router.put('/campgrounds/:id', middleware.checkCampgroundOwnership, upload.single('image'), function(req, res){
    //find Campground to find imageId to delete on cloudinary
    Campground.findById(req.params.id, async function(err, foundCampground) {
        if(err){
           req.flash('error', 'Campground not found')
           return res.redirect('/campgrounds') 
        } else {
            geocoder.geocode(req.body.campground.location, function(err, data){
                if(err || !data.length){
                    console.log('ERROR OCURRED ====> ' + err)
                    req.flash('error', 'Invalid Address')
                    return res.redirect('back')
                }
                foundCampground.lat = data[0].latitude
                foundCampground.lng = data[0].longitude
                foundCampground.location = data[0].formattedAddress
            })
            
            if(req.file){
                try {
                    //delete the previous image (optional depending on app logic)
                    await cloudinary.v2.uploader.destroy(foundCampground.imageId)
                    var result = await cloudinary.v2.uploader.upload(req.file.path)
                    foundCampground.image = result.secure_url;
                    foundCampground.imageId = result.public_id;
                } catch (err) {
                    req.flash('error', err.message)
                    return res.redirect('back') 
                }
            }
            
            foundCampground.name = req.body.campground.name
            foundCampground.price = req.body.campground.price
            foundCampground.description = req.body.campground.description
            foundCampground.save()
            req.flash('success', 'Campground updated!')
            res.redirect('/campgrounds/' + foundCampground._id)
        }

    })
})

//DELETE
router.delete('/campgrounds/:id', middleware.checkCampgroundOwnership, function(req, res){
    //find Campground to find imageId to delete on cloudinary
    Campground.findById(req.params.id, async function(err, foundCampground) {
        if(err){
          req.flash('error', 'Campground not ')
          return res.redirect('/campgrounds') 
        }
        try {
            //delete the previous image (optional depending on app logic)
            await cloudinary.v2.uploader.destroy(foundCampground.imageId)
            foundCampground.remove()
            req.flash('success', 'Campground deleted')
            return res.redirect('/campgrounds')
        } catch (err) {
            req.flash('error', err.message)
            return res.redirect('back') 
        }
    })
})

function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
}

module.exports = router