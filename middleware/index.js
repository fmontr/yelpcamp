var Campground = require("../models/campground.js"),
    Comment = require("../models/comment.js")

var middlewareObj = {}

//IMPORTANT: not checking !foundCampground resulted in a bug CRASHING the application.
//this happened when the id was changed in the URL (keeping the same length), and
//when requested, findById callback returned nothing, since nothing was found under
//that id on DB. When we try to access a property of foundCampground an error 
//occurs and the whole app crashes. The workaround is done where needed.
middlewareObj.checkCampgroundOwnership = function (req, res, next){
    if(req.isAuthenticated()){
        Campground.findById(req.params.id, function(err, foundCampground){
            if(err || !foundCampground){
                console.log('ERROR OCURRED ====> ' + err)
                req.flash('error', 'Campground not found')
                res.redirect('back')
            } else {
                //check if user owns the campground
                if (foundCampground.author.id.equals(req.user._id)) {
                    return next()
                } else {
                    req.flash('error', 'You do not have permission to do that')
                    res.redirect('back')
                }
            }
        })
    } else {
        req.flash('error', 'Please log in first')
        res.redirect('back')
    }
}

middlewareObj.checkCommentOwnership = function (req, res, next){
    if(req.isAuthenticated()){
        Comment.findById(req.params.commentId, function(err, foundComment){
            if(err || !foundComment){
                console.log('ERROR OCURRED =======>' + err)
                req.flash('error', 'Comment not found')
                res.redirect('back')
            } else {
                //check if user owns the campground
                if (foundComment.author.id.equals(req.user._id)) {
                    return next()
                } else {
                    req.flash('error', 'You do not have permission to do that')
                    res.redirect('back')
                }
            }
        })
    } else {
        req.flash('error', 'Please log in first')
        res.redirect('back')
    }
}

middlewareObj.isLoggedIn = function (req, res, next){
    if(req.isAuthenticated()){
        return next()
    }
    req.flash('error', 'Please log in first')
    res.redirect('/login')
}

module.exports = middlewareObj