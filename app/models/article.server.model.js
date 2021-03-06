const mongoose = require('mongoose'),
      Schema = mongoose.Schema;

const ArticleSchema = new Schema({
  community : {
    type : String,
    required : 'community is required'
  },
  university : {
    type : String,
    required : 'university is required'
  },
  boardAddr : {
    type : String,
    required : 'boardAddr is required'
  },
  title : {
    type : String
  },
  author : {
    type : String
  },
  content : {
    type : String
  },
  images : [{
    type : String
  }],
  createdDate : {
    type : Date
  },
  crawledDate : {
    type : Date,
    default : Date.now
  }
}, {
  versionKey: false,
  usePushEach : true
});

mongoose.model('Article', ArticleSchema);
