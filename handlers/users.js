const { admin,db } = require('../server/admin')
const firebase = require('firebase');
const config = require('../server/config');

firebase.initializeApp(config);

const isEmpty = string => string.trim() === "" ? true : false

const isEmail = email => email.match(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/) ? true : false


exports.signup = (req,res)=> {
    const newUser = {
      email: req.body.email,
      password: req.body.password,
      confirmPassword: req.body.confirmPassword,
      userHandle: req.body.userHandle
    }
  
    let errors = {};
  
    if(isEmpty(newUser.email) || !isEmail(newUser.email)){
      errors.email = 'Must be a valid email'
    }
  
    if(isEmpty(newUser.password)) errors.password = 'Must not be empty'
    if(newUser.password !== newUser.confirmPassword) errors.confirmPassword = "Password must match";
    if(isEmpty(newUser.userHandle)) errors.userHandle = 'Must not be empty'
  
    if(Object.keys(errors).length || Object.keys(newUser).some(k => !newUser[k])) return res.status(400).json(errors);
  
    let noImg = 'person-placeholder.jpg';
    //need to validate data
    let token;
    db.doc(`/users/${newUser.userHandle}`).get()
    .then(doc =>{
      if(doc.exists){
        res.status(400).json({handle:'this handle is taken'})
      } else {
        return firebase
        .auth()
        .createUserWithEmailAndPassword(newUser.email,newUser.password)
      }
    })
      .then(data =>{
        userId = data.user.uid;
        return data.user.getIdToken();
      })
      .then(idtoken =>{
        token = idtoken;
        const userCredentials = {
          userHandle: newUser.userHandle,
          email: newUser.email,
          profileImg: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
          createdAt: new Date().toISOString(),
          userId
        };
        return db.doc(`/users/${newUser.userHandle}`).set(userCredentials);
      })
      .then(()=>{
        res.status(201).json({token});
      })
      .catch(err => {
        console.error(err);
        if(err.code === 'auth/email-already-in-use'){
          return res.status(400).json({email: 'Email already in use'})
        }
        return res.status(500).json({message: 'Something went wrong. Please try again!s'});
      });
  }
  

  
    exports.login = (req,res) =>{
      const user = {
        email: req.body.email,
        password: req.body.password
      };
  
      let errors = {};
  
      if(isEmpty(user.email)) errors.email = 'Must not be empty';
      if(!isEmail(user.email)) errors.email = 'Must be a valid email';
      if(isEmpty(user.password)) errors.password = 'Must not be empty';
  
      if(Object.keys(errors).length) return res.status(400).json(errors);
  
      firebase.auth().signInWithEmailAndPassword(user.email,user.password)
      .then(data => {
        return data.user.getIdToken();
      })
      .then(token => {
        return res.status(200).json({token})
      })
      .catch(err => {
        if(err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found'){
          return res.status(403).json({general : 'Wrong credentials, plese try again'})
        }
        console.error(err);
        return res.status(500).json({error: err.code});
      })
  
  }

  exports.addUserBio = (req,res)=>{
    let userBio = {}
    if(req.body.about) userBio.about = req.body.about;
    if(req.body.location) userBio.location = req.body.location;
    db.doc(`/users/${req.user.handle}`).update(userBio)
    .then(()=>{
      res.json({message: 'Details added sucessfullly'});
    })
    .catch(err =>{
      console.log(err);
      res.status(500).json({error: err.code});
    })
  }


  exports.getUserByHandle = (req,res) => {
    let userData  = {};
    db.doc(`/users/${req.params.handle}`).get()
      .then(doc =>{
        if(doc.exists){
          userData.user = doc.data();
          return db.collection('posts').where('userHandle','==',req.params.handle)
            .orderBy('createdAt','desc')
            .get();
        } else {
          res.status(404).json({error: 'Not found'})
        }
      })
      .then(data => {
        userData.posts = [];
        data.forEach(doc =>{
          userData.posts.push({...doc.data(),postID: doc.id});
        })
        return res.json(userData);
      })
      .catch(err => {
        console.error(err);
        return res.status(500).json({error: err.code})
      })
  }

  exports.fetchUserData = (req,res) =>{
    let userData ={};
    db.doc(`/users/${req.user.handle}`).get()
    .then(doc => {
      if(doc.exists){
        userData.credentials = doc.data();
        return db.collection('likes').where('userHandle', '==', req.user.handle).get();
      }
    })
    .then(data => {
      userData.likes  = [];
      data.forEach(doc => {
        data.forEach(doc => {
          userData.likes.push(doc.data());
        })
      });
      return db.collection('notifications').where('recipient','==',req.user.handle)
        .orderBy('createdAt','desc').limit(15).get();
    })
    .then(data => {
      userData.notifications = [];
      data.forEach(doc => {
        userData.notifications.push(doc.data());
      })
      return res.json(userData);
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({error: err.code});
    })
  }

  exports.uploadImage = (req,res) => {
      const BusBoy = require('busboy');
      const path = require('path');
      const os = require('os');
      const fs = require('fs');

      let imgFileName;
      let imgToBeUploaded;

      const busboy = new BusBoy({ headers: req.headers });

      busboy.on('file',(fieldname, file, filename, encoding, MimeType) => {
        if(MimeType !== 'image/jpeg' && MimeType !== 'image/png'){
          return res.status(400).json({message: 'Upload a valid image, The current supported formats are image/jpeg and image/png'});
        }
        const imgExitension = filename.split('.')[filename.split('.').length-1];
        imgFileName = `${Math.round(Math.random()*1000000000)}.${imgExitension}`;
        const filepath = path.join(os.tmpdir(), imgFileName);
        imgToBeUploaded = {filepath,MimeType};
        file.pipe(fs.createWriteStream(filepath));
      });
      busboy.on('finish',()=>{
        admin.storage().bucket().upload(imgToBeUploaded.filepath ,{
          resumable: false,
          metadata: {
            metadata: {
              contentType: imgToBeUploaded.MimeType
            }
          }
        })
        .then(()=>{
          const profileImg = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imgFileName}?alt=media`;
          return db.doc(`/users/${req.user.handle}`).update({ profileImg });
        })
        .then(()=>{
          return res.json({message: 'Image uploaded sucessfully'});
        })
        .catch(err=>{
          console.log(err);
          res.status(500).json({err});
        })
      });
      busboy.end(req.rawBody);
  }

  exports.markNotificationRead = (req,res) => {
    let batch = db.batch();
    req.body.forEach(notificationsId => {
      const notification = db.doc(`/notifications/${notificationsId}`);
      batch.update(notification, { read: true })
    })
    batch.commit()
      .then(()=>{
        return res.json({message: 'Notifications marked read!'});
      })
      .catch(err => {
        console.error(err);
        res.status(500).json({error: err.code});
      })
  }