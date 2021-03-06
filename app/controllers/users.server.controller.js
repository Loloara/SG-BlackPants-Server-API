const User = require('mongoose').model('User'),
      elasticsearch = require('../apis/elasticsearch'),
      Keyword = require('mongoose').model('Keyword'),
      crypto= require('crypto'),
      config = require('../../config/config'),
      firebase = require('../apis/firebase'),
      redis = require('../apis/redis');

exports.signup = (req, res, next) => {
  const user = new User(req.body);
  user.save(err => {
    if(err) next(err);
    res.json(user);
  });
};

exports.list_mongoDB = (req, res, next) => {
  User.find((err,users) => {
    if(err) next(err);
    res.json(users);
  });
};

exports.list_elasticsearch = (req, res, next) => {
  elasticsearch.search(req, res, 'univscanner', 'users', {
    query : { match_all : {}}
  });
};

exports.read = (req, res, next) => {
  res.json(req.user);
};

exports.userByID = (req, res, next, id) => {
  User.findById(id, (err, user) => {
    if(err) return next(err);
    if(!user) req.user = null;
    else req.user = user;
    next();
  });
};

exports.addSearchHistory = (req, res, next) => {
  const search = req.body.search.trim();
  const searchIndex = req.user.search.indexOf(search);
  if(searchIndex > -1){ //중복이 존재한다면 갱신
    req.user.search.splice(searchIndex, 1);
  }
  if(req.user.search.length === 10){ //10개 이상시 마지막 원소 제거
    req.user.search.pop();
  }
  req.user.search.unshift(search);

  req.user.save(err => {
    if(err) return next(err);
    res.json({
      "result" : "SUCCESS",
      "code" : "ADD_SEARCH_HISTORY",
      "message" : req.user.search
    });
  })
};

exports.addSearchHistoryAndNext = (req, res, next) => {
  User.findById(req.body._id, (err, user) => {
    req.body.university = user.university;
    const searchIndex = user.search.indexOf(req.params.keyword);
    if(searchIndex > -1){ //중복이 존재한다면 갱신
      user.search.splice(searchIndex, 1);
    }
    if(user.search.length === 10){ //10개 이상시 마지막 원소 제거
      user.search.pop();
    }
    user.search.unshift(req.params.keyword);

    user.save(err => {
      if(err) return next(err);
      next();
    });
  });
};

exports.pushKeywordToUser = (req, res, next) => {
  req.body.keyword = req.body.keyword.trim();
  Keyword.findOne({name : req.body.keyword, university : req.body.university}, (err, keyword) => {
    if(err) return next(err);

    if(!keyword){
      keyword = new Keyword();
      keyword.name = req.body.keyword;
      keyword.university = req.body.university;
    }

    if(req.user.keywords.length === 10) {
      const err = {
        "code" : "EXCEEDED",
        "message" : "keywords exceeds the limit of 10"
      };
      return next(err);
    }else console.log('no exceeded 10')

    const keywordUsersIndex = keyword.users.indexOf(req.user._id);  //keyword 중복 등록
    if(keywordUsersIndex > -1){
      const err = {
        "code" : "DUPLICATE",
        "message" : "keyword is duplicated"
      };
      return next(err);
    }else console.log('no duplicated keyword')
    keyword.users.push(req.user._id);

    const keywordObject = {
      "keyword" : req.body.keyword,
      "university" : req.body.university,
      "community" : [],
      "startDate" : null,
      "endDate" : null,
      "secondWord" : null
    };

    if(req.body.community) {
      keywordObject.community = req.body.community;
    }

    if(req.body.startDate){
      let sdate,edate;
      sdate = req.body.startDate.split('T')[0].split('-');
      edate = req.body.endDate.split('T')[0].split('-');
      keywordObject.startDate = new Date(sdate[0]*1,sdate[1]*1-1,sdate[2]*1,0,0,0);
      keywordObject.endDate = new Date(edate[0]*1,edate[1]*1-1,edate[2]*1,0,0,0);
      console.log(keywordObject.startDate + '-' + keywordObject.endDate);
    }

    if(req.body.secondWord) {
      keywordObject.secondWord = req.body.secondWord;
    }

    req.user.keywords.push(keywordObject);

    let isSucceeded = true;

    req.user.save(err => {    //user update function with keywords push
      if(err) {
        isSucceeded = false;
        return next(err);
      }
      console.log('user updated');
      if(isSucceeded){
        res.json({
              "result" : "SUCCESS",
              "code" : "PUSH_KEYWORD",
              "message" : "success to push keyword and updated all"
            });
      }else{
        res.json({
            "result" : "FAILURE",
            "code" : "PUSH_KEYWORD",
            "message" : "something is wrong"
          });
      }
    });

    keyword.save((err, data) => {
      if(err) {
        isSucceeded = false;
        return next(err);
      }
      console.log('keyword updated');
    });

    const key = req.body.university+":keywords";
    redis.updateItem(key, req.body.keyword, 1)
      .then(reply => {
        console.log('redis updated');
      }).error(err => {
        isSucceeded = false;
        next(err);
      });
  });
};

exports.delete = (req, res, next) => {
  req.user.remove(err => {
    if(err) next(err);
    res.json(req.user);
  });
};

exports.deleteAll = (req, res, next) => {
  User.remove({}, err => {
    if(err) next(err);
    res.json({
      "result" : "SUCCESS",
      "code" : "DeleteAll",
      "message" : "Success to delete users all"
    });
  });
};

exports.isValidToken = (req, res, next) => {
  firebase.verifyIdToken(req.body.userToken).then(decodedToken => {
    if(!decodedToken.uid){
      console.log('invalid token')
      const err = new Error(decodedToken.errorInfo.message);
      err.code = decodedToken.errorInfo.message.split(' ')[4].replace('.','').toUpperCase();
      return next(err);
    }

    console.log('valid token');
    req.body._id = decodedToken.uid;
    req.body.email = decodedToken.email;
    next();
  });
};

exports.decodingToken = (req, res, next) => {
  firebase.verifyIdToken(req.body.userToken).then(decodedToken => {
    if(!decodedToken.uid){
      console.log('invalid token')
      const err = new Error(decodedToken.errorInfo.message);
      err.code = decodedToken.errorInfo.message.split(' ')[4].replace('.','').toUpperCase();
      return next(err);
    }

    console.log('valid token');
    res.json(decodedToken);
  });
};

exports.refreshToken = (req, res, next) => {
  User.findById(req.body._id, (err, user) => {
    user.registrationToken = req.body.registrationToken;
    user.save(err => {
      if(err) return next(err);
      res.json({
        "result" : "SUCCESS",
        "code" : "REFRESH_TOKEN",
        "message" : user
      });
    });
  });
};

exports.getRecentlySearch = (req, res, next) => {
  if(req.user) return res.json(req.user.search);
  else return res.json([]);
};

exports.popKeyword = (req, res, next) => {
  Keyword.findOne({ name : req.body.keyword, university : req.body.university })
      .exec((err, keyword) => {
        const userIndex = keyword.users.indexOf(req.params.userId);
        keyword.users.splice(userIndex, 1);
        keyword.save(err => {
          if(err) return next(err);
          redis.updateItem(keyword.university+":keywords", keyword.name, -1)
            .then(reply => {
              User.findByIdAndUpdate(req.params.userId,
                { $pull : { keywords : { keyword : req.body.keyword, university : req.body.university } } },
                {safe : true, upsert: true},
                (err, user) => {
                    if(err) return next(err);
                    return res.json({
                      "result" : "SUCCESS",
                      "code" : "DELETE_KEYWORD",
                      "message" : "success to delete keyword from user"
                    });
                });
            }).error(err => {
              next(err);
            });
        });
      });
};

function encrypt(password){
    const cipher = crypto.createCipher(config.algorithm, config.key);
    let result = cipher.update(password, 'utf8', 'base64');
    result += cipher.final('base64');

    return result;
};

function decrypt(password){
    const decipher = crypto.createDecipher(config.algorithm, config.key);
    let result = decipher.update(password, 'base64', 'utf8');
    result += decipher.final('utf8');

    return result;
};
