var express = require("express")
var router = express.Router()

var Campground = require("../models/campground.js"),
    Comment = require("../models/comment.js")

var middleware = require("../middleware")


//NEW
router.get('/campgrounds/:id/comments/new', middleware.isLoggedIn, function(req, res) {
    Campground.findById(req.params.id, function(err, campground){
        if(err || !campground){
            console.log(err)
        } else {
            res.render('comments/new', {campground : campground})
        }
    })
})

//CREATE
router.post('/campgrounds/:id/comments', middleware.isLoggedIn, function(req, res){
    Campground.findById(req.params.id, function(err, campground) {
        if(err || !campground){
            console.log(err)
        } else {
            Comment.create(req.body.comment, function(err, newComment){
                if(err || !newComment) {
                    req.flash('error', 'Something went wrong')
                    console.log(err)
                } else {
                    newComment.author.id = req.user._id
                    newComment.author.username = req.user.username
                    newComment.save(function(err){
                        if(err){
                            console.log('ERROR OCURRED =====>' + err)
                        }
                    })
                    campground.comments.push(newComment)
                    campground.save(function(err){
                        if(err){
                            console.log(err)
                        } else {
                            req.flash('success', 'Successfully created comment')
                            res.redirect('/campgrounds/' + req.params.id)
                        }
            })
                }
            })
        }
    })    
})

//EDIT FORM
router.get('/campgrounds/:id/comments/:commentId/edit', middleware.checkCommentOwnership, function(req, res){
    Campground.findById(req.params.id, function(err, foundCampground) {
        if(err || !foundCampground){
            console.log('ERROR OCURRED ====>' + err)
            req.flash('error', 'Campground not found')
            res.redirect('/campgrounds')
        } else {
            Comment.findById(req.params.commentId, function(err, foundComment) {
                if(err || !foundComment){
                    console.log('ERROR OCURRED ====>' + err)
                    req.flash('error', 'Comment not found')
                    res.redirect('/campgrounds')
                } else {
                    res.render('comments/edit', {foundCampground:foundCampground, foundComment:foundComment})
                }
            })
        }
    })
})

//UPDATE
router.put('/campgrounds/:id/comments/:commentId', middleware.checkCommentOwnership, function(req, res){
    Comment.findByIdAndUpdate(req.params.commentId, req.body.comment, function(err, updatedComment){
        if(err || !updatedComment){
            console.log('ERROR OCURRED =====>' + err)
        } else {
            updatedComment.createdAt = Date.now()
            updatedComment.wasEdited = true
            updatedComment.save()
            res.redirect('/campgrounds/' + req.params.id)
        }
    })
})

//DELETE
router.delete('/campgrounds/:id/comments/:commentId', middleware.checkCommentOwnership, function(req, res){
    Comment.findByIdAndRemove(req.params.commentId, function(err){
        if(err){
            console.log('ERROR OCURRED ===>' + err)
        } else {
            req.flash('success', 'Comment deleted')
            res.redirect('/campgrounds/' + req.params.id)
        }
    })
})

module.exports = router