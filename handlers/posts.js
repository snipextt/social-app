const { db } = require('../server/admin')

exports.getAllPosts = (req,res)=>{
    const usr = {};
    db.collection('posts').get()
    .then(snapshot => {
      snapshot.forEach(doc =>{
        usr[doc.id] = doc.data();
        usr[doc.id.profileImg] = doc.data().profileImg;
      });
      return res.status(200).json({usr});
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({err: err.code});
    })
  
  }

  exports.post = (req,res) =>{
    const post = {
      content: req.body.content,
      userHandle: req.user.handle,
      profileImg: req.user.profileImg,
      createdAt: new Date().toISOString(),
      likeCount: 0,
      commentCount: 0
    }
    db.collection('posts').add(post)
    .then(ref =>{
      const newPost = post;
      newPost.postID = ref.id;
      return res.status(200).json(newPost);
    })
    .catch(err =>{
      console.error(err);
      return res.status(500).json({err:err.code});
    })
  }

  exports.getPost = (req,res) => {
    let postContent = {};
    db.doc(`/posts/${req.params.postID}`).get()
    .then(doc => {
      if(!doc.exists){
        return res.status(404).json({error: 'No post with that id'});
      }
      postContent = doc.data();
      postContent.postID = doc.id;
      return db
      .collection('Comments')
      .orderBy('createdAt','desc')
      .where('postID','==',req.params.postID)
      .get()
      .then(data => {
        postContent.comments = [];
        data.forEach(doc =>{ 
          postContent.comments.push(doc.data());
        });
        return res.json(postContent);
      })
      .catch(err => {
        console.error(err);
        res.status(500).json({error: 'Something went wrong'});
      })
    })
  }
  exports.commentOnPost = (req,res) => {
    if(!req.body.body) return res.status(400).json({message: 'Please provide a comment body'});
    const newComment = {
      body: req.body.body,
      createdAt: new Date().toISOString(),
      postID: req.params.postID,
      userHandle: req.user.handle,
      profileImg: req.user.profileImg
    }

    db.doc(`/posts/${req.params.postID}`).get()
    .then(doc => {
      if(!doc.exists){
        return res.status(404).json({message:'The post does not exists'});
      }
      return doc.ref.update({commentCount: doc.data().commentCount + 1})
    })
    .then(()=>{
      return db.collection('Comments').add(newComment);
    })
    .then(()=>{
      return res.json(newComment);
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({err: 'Something went wrong!'})
    })
  }

exports.likePost = (req,res) => {
  console.log('inside?');
  const likedPost = db.collection('likes').where('userHandle','==',req.user.handle)
    .where('postID','==',req.params.postID).limit(1);

    const targetPost = db.doc(`/posts/${req.params.postID}`);

    let postData;
    targetPost.get()
      .then(doc =>{
        console.log('inside?');
        if(doc.exists){
          postData = doc.data();
          postData.postID = doc.id;
          return likedPost.get();
        } else {
          res.status(500).json({error: 'The post does not exist'});
        }
      })
      .then(data => {
        if(data.empty){
          return db.collection('likes').add({
            postID: req.params.postID,
            userHandle: req.user.handle
          })
          .then(()=>{
            postData.likeCount++
            return targetPost.update({likeCount: postData.likeCount});
          })
          .then(()=>{
            return res.json(postData);
          })
        } else {
          return res.status(400).json({error: 'Screem already liked'});
        }
      })
      .catch(err => {
        console.error(err);
        return res.status(500).json({error: err.code});
      })
}

exports.unlikePost = (req,res) => {

  const likedPost = db.collection('likes').where('userHandle','==',req.user.handle)
  .where('postID','==',req.params.postID).limit(1);

  const targetPost = db.doc(`/posts/${req.params.postID}`);

  let postData;
  targetPost.get()
    .then(doc =>{
      if(doc.exists){
        postData = doc.data();
        postData.postID = doc.id;
        return likedPost.get();
      } else {
        res.status(500).json({error: 'The post does not exist'});
      }
    })
    .then(data => {
      if(data.empty){
        return res.status(400).json({error: 'Screem not liked'});
      } else {
          return db.doc(`/likes/${data.docs[0].id}`).delete()
          .then(()=>{
            postData.likeCount--;
            return targetPost.update({likeCount: postData.likeCount})
          })
          .then(()=>{
            res.json({postData});
          })
      }
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({error: err.code});
    })
}

exports.deletePost = (req,res) => {
  let targetPost = db.doc(`/posts/${req.params.postID}`);
  targetPost.get()
  .then(doc => {
    if(!doc.exists){
      return res.status(404).json({error: 'Post not found'});
    }
    if(doc.data().userHandle !== req.user.handle){
      return res.status(403).json({error: 'Unauthorized'});
    } else {
      return targetPost.delete();
    }
  })
  .then(()=>{
    return res.json({message: 'Post deleted sucessfully'});
  })
  .catch(err => {
    console.error(err);
    res.status(500).json({error: err.code});
  })
}