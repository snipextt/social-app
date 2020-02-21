const functions = require('firebase-functions');
const express = require('express');
const firebase = require('firebase');
const FBAuth = require('./handlers/FBAuth');
const {
  db
} = require('./server/admin')

const app = express();


const {
  getAllPosts,
  post,
  getPost,
  commentOnPost,
  likePost,
  unlikePost,
  deletePost
} = require('./handlers/posts');
const {
  signup,
  login,
  uploadImage,
  addUserBio,
  fetchUserData,
  getUserByHandle,
  markNotificationRead
} = require('./handlers/users');


//User routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImage);
app.post('/user/bio', FBAuth, addUserBio);
app.get('/user', FBAuth, fetchUserData);
app.get('/users/:handle', getUserByHandle);
app.post('/readNotifications', FBAuth, markNotificationRead);

//Post routes
app.get('/posts', getAllPosts);
app.post('/post', FBAuth, post);
app.get('/posts/:postID', getPost);
app.post('/posts/:postID/comment', FBAuth, commentOnPost);
app.get('/posts/:postID/like', FBAuth, likePost);
app.get('/posts/:postID/unlike', FBAuth, unlikePost);
app.delete('/posts/:postID', FBAuth, deletePost)


exports.api = functions.region('asia-east2').https.onRequest(app);

exports.createNotificationOnLike = functions.region('asia-east2').firestore.document('likes/{id}')
  .onCreate(snapshot => {
    db.doc(`/posts/${snapshot.data().postID}`).get()
      .then(doc => {
        if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'like',
            read: false,
            postID: doc.id
          });
        }
      })
      .then(() => {
        return;
      })
      .catch(err => {
        console.error(err);
        return;
      })
  });

exports.createNotificationOnComment = functions.region('asia-east2').firestore.document('Comments/{id}')
  .onCreate(snapshot => {
    db.doc(`/posts/${snapshot.data().postID}`).get()
      .then(doc => {
        if (doc.exists && doc.data().userHandle !== snapshot.data().userHandle) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'Comment',
            read: false,
            postID: doc.id
          });
        }
      })
      .then(() => {
        return;
      })
      .catch(err => {
        console.error(err);
        return;
      })
  });

exports.deleteNotificationOnUnlike = functions.region('asia-east2').firestore.document('likes/{id}')
  .onDelete(snapshot => {
    db.doc(`/notifications/${snapshot.id}`)
      .delete()
      .then(() => {
        return;
      })
      .catch(err => {
        console.error(err);
        return;
      })
  })


exports.onUserImageChange = functions
  .region('asia-east2')
  .firestore.document('/users/{userId}')
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().profileImg !== change.after.data().profileImg) {
      console.log('image has changed');
      const batch = db.batch();
      return db
        .collection('posts')
        .where('userHandle', '==', change.before.data().userHandle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const scream = db.doc(`/screams/${doc.id}`);
            batch.update(scream, {
              profileImg: change.after.data().profileImg
            });
          });
          return batch.commit();
        });
    } else return true;
  });

exports.onPostDelete = functions
  .region('asia-east2')
  .firestore.document('/posts/{postID}')
  .onDelete((snapshot, context) => {
    const postID = context.params.postID;
    const batch = db.batch();
    return db
      .collection('comments')
      .where('postID', '==', postID)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db
          .collection('likes')
          .where('postID', '==', postID)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection('notifications')
          .where('postID', '==', postID)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });