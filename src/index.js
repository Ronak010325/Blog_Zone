import bodyParser from "body-parser";
import express from "express";
import db from "../Database/database.js";
import env from "dotenv";
import session from "express-session";
import passport from "passport";
import bcrypt from "bcrypt";
import { Strategy } from "passport-local";
import flash from "express-flash";
import multer from "multer";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from "path";

const app = express();
const port = 3000;
const saltRounds = 10;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

let resultRow = [];

function reducer(user_id, arr) {
  arr.filter((value) => {
    if (value.user_id === user_id) {
      value.users = true;
    }
    if (value.blog_title.length >= 21) {
      const title = value.blog_title.slice(0, 21) + "...";
      value.blog_title = title;
    }
    if (value.blog_text.length >= 45) {
      const text = value.blog_text.slice(0, 45) + "...";
      value.blog_text = text;
    }
  })
}

function joiningArray(storage, elements) {
  elements.map((obj) => {
    storage.push(obj);
  });
  return storage;
}

function reduce(blog_id, array) {
  let result = [];
  for (let i = 0; i < 3; i++) {
    if (array[i].blog_title.length >= 16) {
      const title = array[i].blog_title;
      array[i].blog_title = title.slice(0, 17) + "...";
    }
    if (array[i].id != blog_id) {
      result.push(array[i]);
    }
  }
  return result;
}

function newDate() {
  let date = new Date();
  return date.toString().slice(0, 16);
}

function usersProfile(user_id, array) {
  if (array[0].id == user_id) {
    return true;
  } else {
    return false;
  }
}

env.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, //24hr
    },
  })
);
app.use(flash());

app.use((req, res, next) => {
  res.locals.successMessage = req.session.successMessage || null;
  res.locals.failureMessage = req.session.failureMessage || null;
  next();
});

app.use(passport.initialize());
app.use(passport.session());

db.connect();

app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/Dashboard");
  } else {
    res.redirect("/Login");
  }
});

app.get("/Login", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/Dashboard");
  } else {
    res.render("Startup/login.ejs");
  }
});

app.get("/Signup", (req, res) => {
  const message = req.session.failureMessage;
  req.session.failureMessage = null;
  if (req.isAuthenticated()) {
    res.redirect("/Dashboard");
  } else {
    res.render("Startup/signup.ejs", {
      message: message,
    });
  }
});

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  })
});

app.get("/Dashboard", async (req, res) => {
  const message = req.session.successMessage;
  req.session.successMessage = null; // Clear it after use
  if (req.isAuthenticated()) {
    try {
      const user_id = req.user.id;
      const result = await db.query("SELECT blogs.id,user_id,username,blog_title,blog_text,time_created,img FROM user_info JOIN blogs ON user_info.id = blogs.user_id ORDER BY id");
      resultRow = result.rows;
      resultRow.map((obj) => {
        obj.img = obj.img ? obj.img.toString("base64") : null;
      });
      reducer(user_id, resultRow);
      res.render("Dashboard/dashboard.ejs", {
        message: message,
        blogsList: resultRow
      });
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.get("/CreateBlog", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("Form/form.ejs");
  } else {
    res.redirect("/Login");
  }
});

app.get("/search", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const user_id = req.user.id;
      const result = await db.query("SELECT blogs.id,user_id,username,blog_title,blog_text,time_created,img FROM user_info JOIN blogs ON user_info.id = blogs.user_id");
      resultRow = result.rows;
      resultRow.map((obj) => {
        obj.img = obj.img ? obj.img.toString("base64") : null;
      });
      reducer(user_id, resultRow);
      const users = await db.query("SELECT username FROM user_info");
      const userList = users.rows;
      res.render("Search/search.ejs", {
        blogsList: resultRow,
        userList: userList
      });
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.get("/contact", (req, res) => {
  const message = req.session.successMessage;
  req.session.successMessage = null;
  if (req.isAuthenticated()) {
    res.render("ContactUs/contactUs.ejs", {
      message: message
    });
  } else {
    res.redirect("/Login");
  }
});

app.get("/profile", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      // let usersProfileCon;
      const user_id = req.user.id;
      const result = await db.query("SELECT blogs.id,user_id,name,username,blog_title,blog_text,time_created,img FROM user_info JOIN blogs ON user_info.id = blogs.user_id WHERE user_id = $1 ORDER BY id", [
        user_id
      ]);
      const user_info = await db.query("SELECT * FROM user_info WHERE id = $1", [user_id]);
      const user = user_info.rows;
      resultRow = result.rows;
      resultRow.map((obj) => {
        obj.img = obj.img ? obj.img.toString("base64") : null;
      });
      reducer(user_id, resultRow);
      // usersProfileCon = usersProfile(user_id, user);
      const post_count = await db.query("SELECT * FROM blogs WHERE user_id = $1", [user_id]);
      const followers = await db.query("SELECT * FROM following_list WHERE follower_ = $1", [user_id]);
      const following = await db.query("SELECT * FROM following_list WHERE following_ = $1", [user_id]);
      res.render("Profile/profile.ejs", {
        profileId: user_id,
        user: user,
        blogsList: resultRow,
        usersprofile: usersProfile(user_id, user),
        post_Count: post_count.rowCount,
        follower_count: followers.rowCount,
        following_count: following.rowCount,
      });
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

let viewBlogId, viewBloginfo, likeCount, likeCondition;

app.get("/view", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const user_id = req.user.id;
      const likeCountResult = await db.query("SELECT * FROM post_likes WHERE blog_id = $1", [viewBlogId]);
      likeCount = likeCountResult.rowCount;
      const check = await db.query("SELECT * FROM post_likes WHERE user_id=$1 AND blog_id=$2", [user_id, viewBlogId]);
      likeCondition = (check.rowCount > 0) ? true : false;
      const commentResult = await db.query("SELECT post_comments.id,user_id, username ,blog_comment FROM user_info JOIN post_comments ON user_info.id = post_comments.user_id WHERE post_comments.blog_id = $1 ORDER BY id DESC", [viewBlogId]);
      const commentList = commentResult.rows;
      const category = viewBloginfo.category;
      const similarBlogResult = await db.query("SELECT blogs.id, blog_title, img, username FROM user_info JOIN blogs ON user_info.id = blogs.user_id WHERE category = $1 LIMIT 3", [category]);
      const similarPostList = reduce(viewBlogId, similarBlogResult.rows);
      similarPostList.map((obj) => {
        obj.img = obj.img ? obj.img.toString("base64") : null;
      });
      res.render("blogpostView/view.ejs", {
        blogInfo: viewBloginfo,
        likecount: likeCount,
        user_id: user_id,
        likeEmoji: likeCondition,
        comments: commentList,
        commentsCount: commentResult.rowCount,
        similiarPosts: similarPostList
      });
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.post("/Signup", async (req, res) => {
  const { name, username, password } = req.body;
  const img = "Images/Profileimg.jpeg";
  try {
    const checkResult = await db.query(
      "SELECT * FROM user_info WHERE username = $1",
      [username]
    );
    if (checkResult.rowCount > 0) {
      // User already exist login
      req.session.failureMessage = "UserName Already Exist ! Please Login";
      res.redirect("/Signup"); //username already exist.
    } else {
      // User does't exist add user
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.log("Error While Hashing : " + err);
        } else {
          const result = await db.query(
            "INSERT INTO user_info (profileimg, name, username, password) VALUES ($1, $2, $3, $4) RETURNING *",
            [img, name, username, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            if (err) console.log(err);
            req.session.successMessage = "Success ✅";
            res.redirect("/Dashboard");
          });
        }
      });
    }
  } catch (error) {
    console.log(error);
  }
});

app.post("/Login",
  passport.authenticate("login", {
    failureRedirect: "/Login",
    failureFlash: "Incorrect Username or Password !", //req.session.message
  }),
  (req, res) => {
    req.session.successMessage = "Success ✅";
    res.redirect("/Dashboard");
  }
);

app.post("/view", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      viewBlogId = req.body.view;
      const blog_id = req.body.view;
      const Blogresult = await db.query("SELECT user_info.id, user_info.profileimg, user_info.name, username, blogs.id AS blog_id, blog_title, blog_text, time_created, category, img FROM user_info JOIN blogs ON user_info.id = blogs.user_id WHERE blogs.id = $1", [
        blog_id
      ]);
      Blogresult.rows.map((obj) => {
        obj.img = obj.img ? obj.img.toString("base64") : null;
      });
      viewBloginfo = Blogresult.rows[0];
      res.redirect("/view");
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.post("/view/like", async (req, res) => {
  if (req.isAuthenticated()) {
    const user_id = req.user.id;
    const blog_id = req.body.like_blogpost;
    try {
      const check = await db.query("SELECT * FROM post_likes WHERE user_id=$1 AND blog_id=$2", [user_id, blog_id]);
      if (check.rowCount > 0) {
        // user has already liked the post dislike karna hai usko
        await db.query("DELETE FROM post_likes WHERE user_id=$1", [user_id]);
      } else {
        await db.query("INSERT INTO post_likes(blog_id,user_id) VALUES ($1, $2)", [
          blog_id, user_id
        ]);
      }
      res.redirect("/view");
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.post("/view/comment", async (req, res) => {
  if (req.isAuthenticated()) {
    const user_id = req.user.id;
    const blog_id = req.body.blog_id;
    const comment = req.body.comment;
    await db.query("INSERT INTO post_comments (blog_id, user_id, blog_comment) VALUES ($1, $2, $3)", [
      blog_id, user_id, comment
    ]);
    res.redirect("/view");
  } else {
    res.redirect("/Login");
  }
});

app.post("/view/blog", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const blog_id = req.body.blog_id;
      viewBlogId = req.body.blog_id;
      const Blogresult = await db.query("SELECT user_info.id, user_info.profileimg, user_info.name, username, blogs.id AS blog_id, blog_title, blog_text, time_created, category, img FROM user_info JOIN blogs ON user_info.id = blogs.user_id WHERE blogs.id = $1", [
        blog_id
      ]);
      Blogresult.rows.map((obj) => {
        obj.img = obj.img ? obj.img.toString("base64") : null;
      });
      viewBloginfo = Blogresult.rows[0];
      res.redirect("/view");
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.post("/view/profile", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const userid = req.body.user_id;
      const user_id = req.user.id;
      const result = await db.query("SELECT blogs.id,user_id,name,username,blog_title,blog_text,time_created,img FROM user_info JOIN blogs ON user_info.id = blogs.user_id WHERE user_id = $1 ORDER BY id", [
        userid
      ]);
      const user_info = await db.query("SELECT * FROM user_info WHERE id = $1", [userid]);
      const user = user_info.rows;
      resultRow = result.rows;
      resultRow.map((obj) => {
        obj.img = obj.img ? obj.img.toString("base64") : null;
      });
      reducer(user_id, resultRow);
      const post_count = await db.query("SELECT * FROM blogs WHERE user_id = $1", [userid]);
      const followers = await db.query("SELECT * FROM following_list WHERE follower_ = $1", [userid]);
      const following = await db.query("SELECT * FROM following_list WHERE following_ = $1", [userid]);
      const check = await db.query("SELECT * FROM following_list WHERE follower_= $1 AND following_= $2", [userid, user_id]);
      res.render("Profile/profile.ejs", {
        profileId: user_id,
        user: user,
        blogsList: resultRow,
        usersprofile: usersProfile(user_id, user),
        post_Count: post_count.rowCount,
        follower_count: followers.rowCount,
        following_count: following.rowCount,
        bloggersId: userid,
        checkFollowing: check.rowCount
      });
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.post("/view/comment_delete", async (req, res) => {
  if (req.isAuthenticated()) {
    const comment_id = req.body.delete_comment;
    try {
      await db.query("DELETE FROM post_comments WHERE id = $1", [comment_id]);
      res.redirect("/view");
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.post("/profile/edit", async (req, res) => {
  if (req.isAuthenticated()) {
    const blog_id = req.body.edit;
    try {
      const result = await db.query("SELECT blog_title,blog_text,category,img FROM blogs WHERE id = $1", [
        blog_id
      ])
      result.rows.map((obj) => {
        obj.img = obj.img ? obj.img.toString("base64") : null;
      });
      const blogDetails = result.rows[0];
      res.render("Form/form.ejs", {
        edit: true,
        blogD: blogDetails,
        blogId: blog_id
      });
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.post("/edit/submit", upload.single("image"), async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const blog_id = req.body.blogId;
      const title = req.body.blogTitle;
      const text = req.body.blogText;
      let category = req.body.category;
      if (category === 'Select Category') {
        category = 'Others'
      }
      const time = newDate();
      const img = 'Images/Logo.png';
      const coverImg = req.file ? req.file.buffer : null;
      if (coverImg) {
        await db.query("update blogs set blog_title=$1, blog_text=$2, time_created=$3, category=$4, img=$5 WHERE id = $6", [
          title, text, time, category, coverImg, blog_id
        ]);
      } else {
        await db.query("UPDATE blogs set blog_title=$1, blog_text=$2, time_created=$3, category=$4 WHERE id=$5", [
          title, text, time, category, blog_id
        ]);
      }
      res.redirect("/profile");
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.post("/profile/delete", async (req, res) => {
  if (req.isAuthenticated()) {
    const blog_id = req.body.delete;
    await db.query("DELETE FROM post_likes WHERE blog_id=$1", [blog_id]);
    await db.query("DELETE FROM post_comments WHERE blog_id=$1", [blog_id]);
    await db.query("DELETE FROM blogs WHERE id=$1", [blog_id]);
    res.redirect("/profile");
  } else {
    res.redirect("/Login");
  }
});

app.post("/CreateBlog/submit", upload.single("image"), async (req, res) => {
  if (req.isAuthenticated()) {
    let { blogTitle, blogText, category } = req.body;
    const user_id = req.user.id;
    if (category === 'Select Category') {
      category = 'Others'
    }
    const time = newDate();
    const coverImg = req.file.buffer;
    try {
      await db.query("INSERT INTO blogs (user_id, blog_title, blog_text, time_created, category, img) VALUES ($1, $2, $3, $4, $5, $6)", [
        user_id, blogTitle, blogText, time, category, coverImg
      ]);
      req.session.successMessage = "Blog Uploaded ✅";
      res.redirect("/Dashboard");
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.post("/contact/submit", async (req, res) => {
  if (req.isAuthenticated) {
    try {
      const { name, email, message } = req.body;
      await db.query("INSERT INTO contact_us VALUES ($1, $2, $3)", [
        name, email, message
      ]);
      req.session.successMessage = "Thanks For Your Message ❤️";
      res.redirect("/contact");
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.post("/profile/editUser", (req, res) => {
  const Reqname = req.user.name;
  const Requsername = req.user.username;
  res.render("Profile/editForm.ejs", {
    name: Reqname,
    username: Requsername
  });
});

app.post("/profile/editUser/submit", async (req, res) => {
  const id = req.user.id;
  const name = req.body.name;
  const username = req.body.username;
  try {
    await db.query("UPDATE user_info SET username=$1,name=$2 WHERE id = $3", [
      username, name, id
    ]);
    req.user.name = name;
    req.user.username = username;
    res.redirect("/profile");
  } catch (error) {
    res.render("Profile/editForm.ejs", {
      name: name,
      username: username,
      error: "Username Already Exist !"
    });
  }
});

app.post("/search", async (req, res) => {
  if (req.isAuthenticated) {
    try {
      const user_id = req.user.id;
      const ogContent = req.body.search;
      const upContent = ogContent.slice(0, 1).toUpperCase() + ogContent.slice(1, ogContent.length);
      const lowContent = ogContent.slice(0, 1).toLowerCase() + ogContent.slice(1, ogContent.length);
      const result1 = await db.query("SELECT blogs.id,user_id,username,blog_title,blog_text,time_created,img FROM user_info JOIN blogs ON user_info.id = blogs.user_id WHERE blog_title LIKE '%' || $1 || '%' ORDER BY id", [upContent]);
      const result2 = await db.query("SELECT blogs.id,user_id,username,blog_title,blog_text,time_created,img FROM user_info JOIN blogs ON user_info.id = blogs.user_id WHERE blog_title LIKE '%' || $1 || '%' ORDER BY id", [lowContent]);
      resultRow = joiningArray(result1.rows, result2.rows);
      resultRow.map((obj) => {
        obj.img = obj.img ? obj.img.toString("base64") : null;
      });
      reducer(user_id, resultRow);
      const users = await db.query("SELECT username FROM user_info WHERE username = $1", [ogContent]);
      const userList = users.rows;
      res.render("Search/search.ejs", {
        blogsList: resultRow,
        userList: userList
      });
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.post("/search/categories", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const user_id = req.user.id;
      const category = req.body.categories;
      const result = await db.query("SELECT blogs.id,user_id,username,blog_title,blog_text,time_created,img FROM user_info JOIN blogs ON user_info.id = blogs.user_id WHERE category = $1 ORDER BY id", [
        category
      ]);
      resultRow = result.rows;
      resultRow.map((obj) => {
        obj.img = obj.img ? obj.img.toString("base64") : null;
      });
      reducer(user_id, resultRow);
      const users = await db.query("SELECT username FROM user_info");
      const userList = users.rows;
      res.render("Search/search.ejs", {
        blogsList: resultRow,
        userList: userList
      });
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.post("/search/user", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const inputUsername = req.body.user;
      const user_id = req.user.id;
      const result = await db.query("SELECT blogs.id,user_id,name,username,blog_title,blog_text,time_created,img FROM user_info JOIN blogs ON user_info.id = blogs.user_id WHERE username = $1", [
        inputUsername
      ]);
      const UserIdResult = await db.query("SELECT id FROM user_info WHERE username = $1", [inputUsername]);
      const userid = UserIdResult.rows[0].id;
      const user_info = await db.query("SELECT * FROM user_info WHERE username = $1", [inputUsername]);
      const user = user_info.rows;
      let resultRow = result.rows;
      resultRow.map((obj) => {
        obj.img = obj.img ? obj.img.toString("base64") : null;
      });
      reducer(user_id, resultRow);
      const post_count = await db.query("SELECT * FROM blogs WHERE user_id = $1", [userid]);
      const followers = await db.query("SELECT * FROM following_list WHERE follower_ = $1", [userid]);
      const following = await db.query("SELECT * FROM following_list WHERE following_ = $1", [userid]);
      const check = await db.query("SELECT * FROM following_list WHERE follower_= $1 AND following_= $2", [userid, user_id]);
      res.render("Profile/profile.ejs", {
        profileId: user_id,
        user: user,
        blogsList: resultRow,
        usersprofile: usersProfile(user_id, user),
        post_Count: post_count.rowCount,
        follower_count: followers.rowCount,
        following_count: following.rowCount,
        bloggersId: userid,
        checkFollowing: check.rowCount
      });
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.post("/follow", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const follow = req.body.follow;
      const currentUser = req.user.id;
      const checking = await db.query("SELECT * FROM following_list WHERE following_=$1 AND follower_=$2", [currentUser, follow]);
      if (checking.rowCount == 0) {
        await db.query("INSERT INTO following_list VALUES ($1, $2)", [follow, currentUser]);
      }
      const userid = req.body.follow;
      const user_id = req.user.id;
      const result = await db.query("SELECT blogs.id,user_id,name,username,blog_title,blog_text,time_created,img FROM user_info JOIN blogs ON user_info.id = blogs.user_id WHERE user_id = $1 ORDER BY id", [
        userid
      ]);
      const user_info = await db.query("SELECT * FROM user_info WHERE id = $1", [userid]);
      const user = user_info.rows;
      resultRow = result.rows;
      resultRow.map((obj) => {
        obj.img = obj.img ? obj.img.toString("base64") : null;
      });
      reducer(user_id, resultRow);
      const post_count = await db.query("SELECT * FROM blogs WHERE user_id = $1", [userid]);
      const followers = await db.query("SELECT * FROM following_list WHERE follower_ = $1", [userid]);
      const following = await db.query("SELECT * FROM following_list WHERE following_ = $1", [userid]);
      const check = await db.query("SELECT * FROM following_list WHERE follower_= $1 AND following_= $2", [userid, user_id]);
      res.render("Profile/profile.ejs", {
        profileId: user_id,
        user: user,
        blogsList: resultRow,
        usersprofile: usersProfile(user_id, user),
        post_Count: post_count.rowCount,
        follower_count: followers.rowCount,
        following_count: following.rowCount,
        bloggersId: userid,
        checkFollowing: check.rowCount
      });
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
});

app.post("/unfollow", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const unfollow = req.body.unfollow;
      const currentUser = req.user.id;
      await db.query("DELETE FROM following_list WHERE following_ = $1 AND follower_ = $2", [currentUser, unfollow]);
      const userid = req.body.unfollow;
      const user_id = req.user.id;
      const result = await db.query("SELECT blogs.id,user_id,name,username,blog_title,blog_text,time_created,img FROM user_info JOIN blogs ON user_info.id = blogs.user_id WHERE user_id = $1 ORDER BY id", [
        userid
      ]);
      const user_info = await db.query("SELECT * FROM user_info WHERE id = $1", [userid]);
      const user = user_info.rows;
      resultRow = result.rows;
      resultRow.map((obj) => {
        obj.img = obj.img ? obj.img.toString("base64") : null;
      });
      reducer(user_id, resultRow);
      const post_count = await db.query("SELECT * FROM blogs WHERE user_id = $1", [userid]);
      const followers = await db.query("SELECT * FROM following_list WHERE follower_ = $1", [userid]);
      const following = await db.query("SELECT * FROM following_list WHERE following_ = $1", [userid]);
      const check = await db.query("SELECT * FROM following_list WHERE follower_= $1 AND following_= $2", [userid, user_id]);
      res.render("Profile/profile.ejs", {
        profileId: user_id,
        user: user,
        blogsList: resultRow,
        usersprofile: usersProfile(user_id, user),
        post_Count: post_count.rowCount,
        follower_count: followers.rowCount,
        following_count: following.rowCount,
        bloggersId: userid,
        checkFollowing: check.rowCount
      });
    } catch (error) {
      console.log(error);
    }
  } else {
    res.redirect("/Login");
  }
})

passport.use(
  "login",
  new Strategy(async function verify(username, password, cb) {
    try {
      const checkUser = await db.query(
        "SELECT * FROM user_info WHERE username = $1",
        [username]
      );
      if (checkUser.rowCount > 0) {
        //user exists Login
        const user = checkUser.rows[0];
        const storedPassword = user.password;
        bcrypt.compare(password, storedPassword, (err, valid) => {
          if (err) {
            console.log("Error in Hashing : " + err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb(null, false);
      }
    } catch (error) {
      console.log(error);
    }
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log("Listening on Port : " + port);
});
