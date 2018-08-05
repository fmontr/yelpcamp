var mongoose = require("mongoose")
var passportLocalMongoose = require("passport-local-mongoose")


var userSchema = new mongoose.Schema({
    username: {type: String, unique: true, require: true},
    password: String,
    avatar: String,
    firstName: String,
    lastName: String,
    email: {type: String, unique: true, require: true},
    resetPasswordToken: String,
    resetPasswordExpires: Date
})
//this adds some methods from passport-local-mongoose package to our model
//like the User.authenticate() called on app.js
userSchema.plugin(passportLocalMongoose)

module.exports = mongoose.model('User', userSchema)