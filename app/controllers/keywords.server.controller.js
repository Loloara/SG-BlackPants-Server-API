const Keyword = require('mongoose').model('Keyword'),
      elasticsearch = require('../apis/elasticsearch'),
      redis = require('../apis/redis');

exports.create = (req, res, next) => {
  const keyword = new Keyword(req.body);

  keyword.save(err => {
    if(err) return next(err);
    res.json(keyword);
  });
};

exports.list = (req, res, next) => {
  Keyword.find((err,keywords) => {
    if(err) return next(err);
    res.json(keywords);
  });
};

exports.read = (req, res, next) => {
  Keyword.findOne({name : req.params.name, community : req.params.community}, (err, keyword) => {
    if(err) return next(err);
    if(!keyword){
      const err = new Error('keyword not exists');
      err.code = 'KeywordNotExists';
      return next(err);
    }
    res.json(keyword);
  });
};

exports.update = (req, res, next) => { // only name, community
  req.params.name = '맥북'
  Keyword.findOne({name : req.params.name, community : req.params.community}, (err, keyword) => {
    if(err) return next(err);
    if(!keyword){
      const err = new Error('keyword not exists')
      err.code = 'KeywordNotExists'
      return next(err);
    }

    if(req.body.name) keyword.name = req.body.name;
    if(req.body.community) keyword.community = req.body.community;

    keyword.save(err => {
      if(err) return next(err);
      res.json(keyword);
    });
  });
};

exports.delete = (req, res, next) => {
  Keyword.findOne({name : req.params.name, community : req.params.community}, (err, keyword) => {
    if(err) return next(err);
    if(!keyword){
      const err = new Error('keyword not exists');
      err.code = 'KeywordNotExists'
      return next(err);
    }
    keyword.remove(err => {
      if(err) next(err);
      res.json(keyword);
    });
  });
};

exports.deleteAll = (req, res, next) => {
  Keyword.remove({}, err => {
    if(err) return next(err);
    res.json({
      "result" : "SUCCESS",
      "code" : "DeleteAll",
      "message" : "Success to delete users all"
    });
  });
};

exports.getKeywordsRankByRedis = (req, res, next) => {
  const key = req.params.university+':keywords';
  redis.getRank(key).then(reply => {
    res.json({
      "result" : "SUCCESS",
      "code" : "GET_KEYWORD_RANK",
      "message" : reply
    });
  }).error(err => {
    next(err);
  });
};

exports.getKeywordsRankByES = (req, res, next) => {
  const query = {
    "index" : "univscanner",
    "type" : "keywords",
    "body" : {
      "query" : {
        "bool" : {
          "must" : [
            { "match" : { "university" : req.params.university } }
          ]
        }
      },
      "from" : 0, "size" : 10,
      "_source" : ["name", "count"],
      "sort" : [
        { "count" : { "order" : "desc" } }
      ]
    }
  };

  elasticsearch.searchAndReturn(query)
    .then(result => {
      let rankingArr = [];
      let jobCount = 0;
      result.message.forEach(item => {
        rankingArr.push(item._source.name);
        if(result.message.length === ++jobCount){
          console.log(rankingArr);
          return res.json(rankingArr);
        }
      });
    }).error(err => {
      console.log('error from getPopularKeywords: ' + err);
      return next(err);
    });
};
