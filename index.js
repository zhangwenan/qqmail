var encoder = require("./lib/c_login_2_10135.modified.js");
var cookie_util = require('cookie-util');

var nodegrass = require("nodegrass");
var http = require('http');
var https = require('https');
var mkdirp = require('mkdirp');
var fs = require("fs");
var rest = require('restler');
var log4js = require('log4js');
var cheerio = require('cheerio');
//var httpsFollow302 = require('follow-redirects').https;

/**
 *
 * 以下id的账号，已经无法找回
 * 14330,17560,22238
 */

var iconv = require('iconv-lite');

mkdirp(process.cwd() + '/logs', function (err) {
  if (err) console.error(err);
  //else console.log('验证码文件夹创建成功!');
});

log4js.configure({
  "appenders":[
    {
      "type": "dateFile",
      "filename": "logs/qqmail.log",
      "pattern": "-yyyy-MM-dd",
      "alwaysIncludePattern": false,
      "category": "qqmail"
    },
    {
      "type": "console",
      "category": "console"
    }
  ]
});
var file_logger = log4js.getLogger("qqmail");
var console_logger = log4js.getLogger("console");
var msg = '';

var qqmail = {
  conf: {
    "username":"",
    "password":"",

    "typeid":"3040",
    "softid":"",
    "softkey":""
  },

  qq: null,
  pwd: null,
  cookies: null,
  frame_html_url: '',
  sid: '',

  g_action: "1-12-1444200532430",
  g_t: "20131024001",
  g_version: null,
  g_jsversion: null,
  g_appid: null,
  g_lang: null,
  g_style: null,
  g_daid: null,
  g_pt_ver_md5: null,
  g_login_sig: null,

  g_need_vcode: true,
  g_salt:null,
  g_pt_verifysession_v1: null,
  g_vcode: {
    result: null,
    ysdm_id: null
  },
  vcode_dir: 'vcode_img',


  temp:{

  },

  logged_obj: {
    login_retcode: null,
    login_redirect_url: null,
    login_nick: null
  },

  init: function(conf){
    this.conf = conf;
  },

  clearStorage: function(){
    var self = this;
    self.qq = null;
    self.pwd = null;
    self.cookies = null;
    self.frame_html_url = '';
  },


  /**
   * 登陆qq邮箱
   * @param qq
   * @param pwd
   */
  login: function(qq, pwd, callbacks){
    msg = 'QQ:' + qq + ' 开始登陆 ...'
    console_logger.info(msg);
    file_logger.info(msg);

    this.clearStorage();

    this.qq = qq;
    this.pwd = pwd;
    this.callbacks = callbacks;

    this.visitIndex();
  },

  /**
   * 访问首页mail.qq.com，获取iframe登录框页面的地址
   */
  visitIndex: function(){
    var self = this;

    var iframe_url = "",
      qq_mail_index_url = "https://mail.qq.com/",
      headers_sent = {
        "Host": "mail.qq.com"
        /*"Accept-Encoding": "gzip, deflate"*/
      },
      iframe_reg = new RegExp("<iframe id=[\"']login_frame[\"'].*?src=['\"]([^'\"]+)['\"]></iframe>", "ig");

    msg = self.qq + ', visitIndex start';
    file_logger.info(msg);

    nodegrass.get(qq_mail_index_url, function(data, status, headers){

      iframe_reg.exec(data);
      if(RegExp.$1){
        iframe_url = RegExp.$1;
        self.temp.iframe = iframe_url;
      }

      self.visitIframe();

    }, headers_sent, "gbk");

  },


  /**
   * 访问iframe页面
   * @param iframe_url
   */
  visitIframe: function(){
    var self = this;
    var headers_sent = {};

    msg = self.qq + ', start visitIframe';
    file_logger.info(msg);

    nodegrass.get(self.temp.iframe, function(data, status, headers){

      self.cookies = headers["set-cookie"];

      var login_sig_reg = /pt_login_sig=([^;]+)/;

      if(login_sig_reg.exec(self.cookies) != null){
        self.g_login_sig = RegExp.$1;
      }

      var json_reg = /pt\.ptui=(\{.*?\});\s*<\/script>/;
      if(json_reg.exec(data) != null){

        var ptui = eval('(' + RegExp.$1 + ')');

        self.g_version = ptui.version;
        self.g_jsversion = ptui.ptui_version;
        self.g_appid = ptui.appid;
        self.g_lang = ptui.lang;
        self.g_style = ptui.style;
        self.g_daid = ptui.daid;
        self.g_pt_ver_md5 = ptui.pt_ver_md5;

        self.checkVCode();
      }
      else{
        msg = self.qq + ', ptui not found';
        console_logger.info(msg);
        file_logger.info(msg);
        self.callbacks.complete(self);
      }

    }, headers_sent, "utf8").on('error', function(e) {

      msg = self.qq + "Got error: " + e.message;
      console_logger.info(msg);
      file_logger.info(msg);
      self.callbacks.complete(self);
    });
  },

  postToLogin: function(ptvfsession, p){

    var self = this;
    var url = 'https://ssl.ptlogin2.qq.com/login?u=' + self.qq + '&verifycode=' + self.g_vcode.result +'&pt_vcode_v1=0' +
      '&pt_verifysession_v1=' + ptvfsession + '&p=' + p + '&pt_randsalt=0&' +
      'u1=https%3A%2F%2Fmail.qq.com%2Fcgi-bin%2Flogin%3Fvt%3Dpassport%26vm%3Dwpt%26ft%3Dloginpage%26target%3D%26account%3D'+
      self.qq + '&ptredirect=1&h=1&t=1&g=1&from_ui=1&ptlang=' + self.g_lang + '&action=' + self.g_action +
      '&js_ver=' + self.g_jsversion + '&js_type=1' +
      '&login_sig=' + self.g_login_sig + '&pt_uistyle=' + self.g_style + '&aid=' + self.g_appid + '&daid=' + self.g_daid + '&';


    var header_sent = {
      "Host": self.getHost(url),
      "Referer": "https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=" + self.g_appid + "&daid=" + self.g_daid
      + "&s_url=https://mail.qq.com/cgi-bin/login?vt=passport%26vm=wpt%26ft=loginpage%26target=&style=" + self.g_style
      + "&low_login=1&proxy_url=https://mail.qq.com/proxy.html&need_qr=0&;hide_border=1&border_radius=0"
      + "&self_regurl=http://zc.qq.com/chs/index.html?type=1&app_id=11005?t=regist"
      + "&pt_feedback_link=http://support.qq.com/discuss/350_1.shtml"
      + "&css=https://res.mail.qq.com/zh_CN/htmledition/style/ptlogin_input24e6b9.css",
      "cookie": self.cookies
    };

    msg = self.qq + 'postToLogin';
    file_logger.info(msg);


    var content = '';
    var protocol = self.getProtocol(url);
    protocol.get({
      host:self.getHost(url),
      port:self.getPort(url),
      path:self.getPath(url),
      headers: header_sent
    }, function(res){
      res.setEncoding('binary');
      var status = res.statusCode;
      var headers = res.headers;

      self.cookies = cookie_util.merge_cookie(self.cookies, headers["set-cookie"]);

      res.on('data',function(chunk){
        content += chunk;
      });
      res.on('end',function(){
        content = iconv.decode(new Buffer(content,'binary'),'utf8');

        eval('self.' + content);
        self.cookies = cookie_util.merge_cookie(self.cookies, headers["set-cookie"] || []);

        switch (self.logged_obj.login_retcode){
          case 0:
          case '0':
            self.checkSig(self.logged_obj.login_redirect_url);
            break;
          case 4:
          case '4':
            // 验证码错误，ptuiCB('4','0','','0','您输入的验证码不正确，请重新输入。', '');

            msg = self.qq + ',验证码错误,开始报错';
            file_logger.info(msg);
            console_logger.info(msg);
            self.ysdm_report_err(self.g_vcode.ysdm_id);
            self.callbacks.complete(self);

            break;
          default :
            file_logger.info(self.qq + content);
            self.callbacks.complete(self);
            break;
        }
      });


    }).on('error', function(e){
      console_logger.error(self.qq + '登陆失败, ' + e);
      file_logger.error(self.qq + e);
    });

  },

  checkSig: function(url){
    var self = this;

    var content = '';
    var protocol = self.getProtocol(url);

    msg = self.qq + ', checkSig';
    file_logger.info(msg);

    protocol.get({
      host:self.getHost(url),
      port:self.getPort(url),
      path:self.getPath(url),
      headers: {
        'Host': self.getHost(url),
        'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:41.0) Gecko/20100101 Firefox/41.0',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding':'gzip, deflate'
      }
    }, function(res){
      //res.setEncoding('binary');
      var status = res.statusCode;
      var headers = res.headers;

      self.cookies = cookie_util.merge_cookie(self.cookies, headers["set-cookie"]);

      res.on('data',function(chunk){
        content += chunk;
      });
      res.on('end',function(){
        //var resp = new Buffer(content,'binary');
        if(status == 302){
          self.cgiLogin(headers['location'], headers['set-cookie']);
        }
        else{
          file_logger.info(self.qq + ',checkSig error');
          self.callbacks.complete(self);
        }

      });
    });

  },

  cgiLogin: function(url, cookie){
    var self = this;

    var content = '';
    var protocol = self.getProtocol(url);

    var temp_cookie = cookie_util.get_simple_cookie_str(cookie);

    msg = self.qq + ', cgiLogin';
    file_logger.info(msg);

    protocol.get({
      host:self.getHost(url),
      port:self.getPort(url),
      path:self.getPath(url),
      headers: {
        'Host': self.getHost(url),
        'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:41.0) Gecko/20100101 Firefox/41.0',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding':'gzip, deflate',
        'Cookie': temp_cookie
      }
    }, function(res){
      //res.setEncoding('binary');
      var status = res.statusCode;
      var headers = res.headers;
      self.cookies = cookie_util.merge_cookie(self.cookies, headers["set-cookie"]);


      res.on('data',function(chunk){
        content += chunk;
      });
      res.on('end',function(){
        //var resp = new Buffer(content,'binary');


        if(status == 302){
          // 说明邮箱未开通
          if(/cgi-bin\/autoactivation/.test(headers['location'])){
            self.activateMail(headers['location']);
          }
          else if(/cgi-bin\/loginpage/.test(headers['location'])){
            // 可能出现了验证码等异常
            file_logger.info(self.qq + ',cgiLogin error: loginpage');
            self.callbacks.complete(self);
          }
          else if(/cgi-bin\/frame_html/.test(headers['location'])){
            self.visitFrameHtml(headers['location']);
          }
          else{
            file_logger.info(self.qq + ',cgiLogin error: unknow');
            self.callbacks.complete(self);
          }

        }
        else{
          file_logger.info(self.qq + ',cgiLogin error: not 302');
          self.callbacks.complete(self);
        }

      });
    }).on('error', function(e){
      console_logger.error(self.qq + ',cgiLogin request error, ' + e);
      file_logger.error(self.qq + ',cgiLogin request error, ' + e);
    });

  },

  activateMail: function(url){
    var self = this;

    var content = '';
    var protocol = self.getProtocol(url);

    var temp_cookie = cookie_util.get_simple_cookie_str(self.cookies);

    msg = self.qq + ', activateMail';
    file_logger.info(msg);

    protocol.get({
      host:self.getHost(url),
      port:self.getPort(url),
      path:self.getPath(url),
      headers: {
        'Host': self.getHost(url),
        'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:41.0) Gecko/20100101 Firefox/41.0',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
        //'Accept-Encoding':'gzip, deflate',
        'Cookie': temp_cookie
      }
    }, function(res){
      res.setEncoding('binary');
      var status = res.statusCode;
      var headers = res.headers;

      self.cookies = cookie_util.merge_cookie(self.cookies, headers["set-cookie"] || []);


      res.on('data',function(chunk){
        content += chunk;
      });
      res.on('end',function(){

        if(status == 200){
          content = iconv.decode(new Buffer(content,'binary'),'gbk');
          //console.log(content);

          var reg = new RegExp("_sTargetUrl = '([^']+)';", "i");
          reg.exec(content);
          var reg_result = RegExp.$1;

          var reg2 = new RegExp('href="(/cgi-bin/frame_html[^"]+)"', "i");
          reg2.exec(content);
          var reg_result2 = RegExp.$1;

          if(reg_result.length > 0 && reg_result2.length > 0){
            self.activateMailStep2('https://mail.qq.com' + reg_result);
            self.frame_html_url = "https://mail.qq.com" + reg_result2;
          }
          else{
            msg = self.qq + '激活邮箱发生异常';
            console_logger.info(msg);
            file_logger.info(msg);
            self.callbacks.complete(self);
          }

        }
        else{
          msg = self.qq + '激活邮箱发生异常, status=' + status;
          console_logger.info(msg);
          file_logger.info(msg);
          self.callbacks.complete(self);
        }
      });
    });
  },
  activateMailStep2: function(url){
    var self = this;
    var content = '';
    var protocol = self.getProtocol(url);
    var temp_cookie = cookie_util.get_simple_cookie_str(self.cookies);

    msg = self.qq + ', activateMailStep2';
    file_logger.info(msg);

    var req = protocol.request({
      host:self.getHost(url),
      port:self.getPort(url),
      path:self.getPath(url),
      method: 'POST',
      headers: {
        'Host': self.getHost(url),
        'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:41.0) Gecko/20100101 Firefox/41.0',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
        //'Accept-Encoding':'gzip, deflate',
        'Cookie': temp_cookie
      }
    }, function(res){
      res.setEncoding('binary');
      var status = res.statusCode;
      var headers = res.headers;

      self.cookies = cookie_util.merge_cookie(self.cookies, headers["set-cookie"] || []);


      res.on('data',function(chunk){
        content += chunk;
      });
      res.on('end',function(){

        if(status == 200){
          content = iconv.decode(new Buffer(content,'binary'),'gbk');
          //console.log(content);
          if(content.indexOf("<!--success-->") != -1){
            msg = '【' + self.qq + '】邮箱激活成功';
            console_logger.info(msg);
            file_logger.info(msg);

            self.visitFrameHtml(self.frame_html_url);
          }
          else{
            msg = '【' + self.qq + '】邮箱激活失败,返回:' + content;
            console_logger.info(msg);
            file_logger.info(msg);
            self.callbacks.complete(self);
          }
        }
        else{
          msg = '【' + self.qq + '】邮箱激活失败,status' + status + '返回:' + content;
          console_logger.info(msg);
          file_logger.info(msg);
          self.callbacks.complete(self);
        }
      });
    });

    req.end();
  },

  visitFrameHtml: function(url){
    var self = this;
    self.frame_html_url = url;

    var content = '';
    var protocol = self.getProtocol(url);

    var temp_cookie = cookie_util.get_simple_cookie_str(self.cookies);

    msg = self.qq + ', visitFrameHtml';
    file_logger.info(msg);

    // https://mail.qq.com/cgi-bin/frame_html?sid=jHqD72J8QccakCN1&r=00f23b1af5b52eb585afa0bfa66dade1
    var sid_reg = /sid=([^&]+)/;
    sid_reg.exec(url);
    self.sid = RegExp.$1;

    protocol.get({
      host:self.getHost(url),
      port:self.getPort(url),
      path:self.getPath(url),
      headers: {
        'Host': self.getHost(url),
        'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:41.0) Gecko/20100101 Firefox/41.0',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
        //'Accept-Encoding':'gzip, deflate',
        'Cookie': temp_cookie
      }
    }, function(res){
      res.setEncoding('binary');
      var status = res.statusCode;
      var headers = res.headers;

      self.cookies = cookie_util.merge_cookie(self.cookies, headers["set-cookie"]);


      res.on('data',function(chunk){
        content += chunk;
      });
      res.on('end',function(){

        if(status == 200){
          content = iconv.decode(new Buffer(content,'binary'),'gbk');
          //console.log(content);
          if(/toptitle">退出<\/a>/ig.test(content)){
            msg = '【' + self.qq + '】登陆成功,昵称为：' + self.logged_obj.login_nick;
            console_logger.info(msg);
            file_logger.info(msg);

            if(self.callbacks && self.callbacks.success && typeof self.callbacks.success == 'function'){
              self.callbacks.success(self);
            }
          }
          else{
            msg = '【' + self.qq + '】登陆可能失败, content:' + content;
            console_logger.info(msg);
          }

        }
        else{
          msg = '【' + self.qq + '】登陆可能失败,status=' + status+ ', content:' + content;
          console_logger.info(msg);
          file_logger.info(msg);
        }

        self.callbacks.complete(self);

      });
    });
  },

  /**
   *
   * @param options
   *
   https://set1.mail.qq.com/cgi-bin/mail_list?s=search&searchmode=advance&page=0&topmails=0&subject=&receiver=&sender=no-reply%40qiyi.com&advancesearch=2&flagnew=&attach=&position=2&folderid=all&sid=jHqD72J8QccakCN1&daterange=&resp_charset=UTF8
   */
  search: function(options, callback){
    var self = this;

    var ops = {};
    ops.s = options.s || 'search';
    ops.searchmode = options.searchmode || 'advance';
    ops.page = options.page || '0';
    ops.topmails = options.topmails || '0';
    ops.subject = options.subject || '';
    ops.receiver = options.receiver || '';
    ops.sender = options.sender || '';
    ops.advancesearch = options.advancesearch || '2';
    ops.flagnew = options.flagnew || '';
    ops.attach = options.attach || '';
    ops.position = options.position || '2';
    ops.folderid = options.folderid || 'all';
    ops.daterange = options.daterange || '';
    ops.resp_charset = options.resp_charset || 'UTF8';

    var url = "https://set1.mail.qq.com/cgi-bin/mail_list?" +
      "s=" + ops.s +
      "&searchmode=" + ops.searchmode +
      "&page=" + ops.page +
      "&topmails=" + ops.topmails +
      "&subject=" + encodeURIComponent(ops.subject) +
      "&receiver=" + encodeURIComponent(ops.receiver) +
      "&sender=" + encodeURIComponent(ops.sender) +
      "&advancesearch=" + ops.advancesearch +
      "&flagnew=" + ops.flagnew +
      "&attach=" + ops.attach +
      "&position=" + ops.position +
      "&folderid=" + ops.folderid +
      "&sid=" + self.sid +
      "&daterange=" + ops.daterange +
      "&resp_charset=" + ops.resp_charset;



    var content = '';
    var protocol = self.getProtocol(url);

    var temp_cookie = cookie_util.get_simple_cookie_str(self.cookies);
    msg = self.qq + ', search mail';
    file_logger.info(msg);

    protocol.get({
      host:self.getHost(url),
      port:self.getPort(url),
      path:self.getPath(url),
      headers: {
        'Host': self.getHost(url),
        'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:41.0) Gecko/20100101 Firefox/41.0',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
        //'Accept-Encoding':'gzip, deflate',
        'Cookie': temp_cookie
      }
    }, function(res){
      res.setEncoding('binary');
      var status = res.statusCode;
      var headers = res.headers;

      self.cookies = cookie_util.merge_cookie(self.cookies, headers["set-cookie"]);


      res.on('data',function(chunk){
        content += chunk;
      });
      res.on('end',function(){

        if(status == 200){
          content = iconv.decode(new Buffer(content,'binary'),'utf8');
          $ = cheerio.load(content);
          var mail = $('.toarea input[name=mailid]').eq(0);
          self.read({
            mail_id: mail.val(),
            totime: mail.attr('totime')
          }, callback);
          /*if(/toptitle">退出<\/a>/ig.test(content)){
            msg = '【' + self.qq + '】登陆成功,昵称为：' + self.logged_obj.login_nick;
            console_logger.info(msg);
            file_logger.info(msg);

            if(self.callbacks && self.callbacks.success && typeof self.callbacks.success == 'function'){
              self.callbacks.success(self);
            }
          }
          else{
            msg = '【' + self.qq + '】登陆可能失败, content:' + content;
            console_logger.info(msg);
          }*/

        }
        else{
          /*msg = '【' + self.qq + '】登陆可能失败,status=' + status+ ', content:' + content;
          console_logger.info(msg);
          file_logger.info(msg);*/
        }

        //self.callbacks.complete(self);

      });
    });
  },

  read: function(mail, callback){

    // https://set1.mail.qq.com/cgi-bin/readmail?
    // folderid=1&folderkey=&t=readmail
    // &mailid=ZC1117-SrzIEZx4jgjLpRZAq_uUU62
    // &mode=pre&maxage=3600&base=11.8&ver=18579
    // &sid=lmAmmhcnoyX4zH8p

    var self = this;
    var url = "https://set1.mail.qq.com/cgi-bin/readmail?" +
      "folderid=1" +
      "&folderkey=" +
      "&t=readmail" +
      "&mailid=" + (mail.mail_id || '') +
      "&mode=pre" +
      "&maxage=3600" +
      "&base=11.8" +
      "&ver=18579" +
      "&sid=" + self.sid;


    var content = '';
    var protocol = self.getProtocol(url);

    var temp_cookie = cookie_util.get_simple_cookie_str(self.cookies);
    msg = self.qq + ', read mail';
    file_logger.info(msg);

    protocol.get({
      host:self.getHost(url),
      port:self.getPort(url),
      path:self.getPath(url),
      headers: {
        'Host': self.getHost(url),
        'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:41.0) Gecko/20100101 Firefox/41.0',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
        //'Accept-Encoding':'gzip, deflate',
        'Cookie': temp_cookie
      }
    }, function(res){
      res.setEncoding('binary');
      var status = res.statusCode;
      var headers = res.headers;

      self.cookies = cookie_util.merge_cookie(self.cookies, headers["set-cookie"]);


      res.on('data',function(chunk){
        content += chunk;
      });
      res.on('end',function(){

        if(status == 200){
          content = iconv.decode(new Buffer(content,'binary'),'utf8');
          callback(content);
          /*if(/toptitle">退出<\/a>/ig.test(content)){
           msg = '【' + self.qq + '】登陆成功,昵称为：' + self.logged_obj.login_nick;
           console_logger.info(msg);
           file_logger.info(msg);

           if(self.callbacks && self.callbacks.success && typeof self.callbacks.success == 'function'){
           self.callbacks.success(self);
           }
           }
           else{
           msg = '【' + self.qq + '】登陆可能失败, content:' + content;
           console_logger.info(msg);
           }*/

        }
        else{
          /*msg = '【' + self.qq + '】登陆可能失败,status=' + status+ ', content:' + content;
           console_logger.info(msg);
           file_logger.info(msg);*/
        }

        //self.callbacks.complete(self);

      });
    });
  },


  checkVCode: function(){
    var self = this;
    var url = "https://ssl.ptlogin2.qq.com/check?regmaster=&;pt_tea=1&amp;pt_vcode=0&uin=" + self.qq
      + "&appid=" + self.g_appid + "&js_ver=" + self.g_jsversion + "&js_type=1&login_sig=" + self.g_login_sig
      + "&u1=https%3A%2F%2Fmail.qq.com%2Fcgi-bin%2Flogin%3Fvt%3Dpassport%26vm%3Dwpt%26ft%3Dloginpage%26target%3D&r=" + Math.random();

    var header_sent = {
      "Host": "ssl.ptlogin2.qq.com",
      "Referer": "https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=" + self.g_appid + "&daid=" + self.g_daid
      + "&s_url=https://mail.qq.com/cgi-bin/login?vt=passport%26vm=wpt%26ft=loginpage%26target=&style=" + self.g_style
      + "&low_login=1&proxy_url=https://mail.qq.com/proxy.html&need_qr=0&;hide_border=1&border_radius=0"
      + "&self_regurl=http://zc.qq.com/chs/index.html?type=1&app_id=11005?t=regist"
      + "&pt_feedback_link=http://support.qq.com/discuss/350_1.shtml"
      + "&css=https://res.mail.qq.com/zh_CN/htmledition/style/ptlogin_input24e6b9.css",
      "cookie": self.cookies
    };

    msg = self.qq + ', start checkVCode';
    file_logger.info(msg);

    nodegrass.get(url, function(data, status, headers){
      // 执行ptui_checkVC
      eval('self.' + data);

      self.cookies = cookie_util.merge_cookie(self.cookies, headers["set-cookie"]);

      // 无需图形验证码
      if(!self.g_need_vcode){
        var ptvfsession = self.get_ptvfsession();
        var p = encoder.encode(self.pwd, self.g_salt, self.g_vcode.result);
        msg = self.qq + ',无需验证码，直接开始登陆...';
        console_logger.info(msg);
        file_logger.info(msg);

        self.postToLogin(ptvfsession, p);
      }
      else{
        msg = self.qq + ',开始识别验证码...';
        console_logger.info(msg);
        file_logger.info(msg);

        self.downloadVcode(self.g_vcode.result);
      }
    }, header_sent, "utf8");

  },



  ptui_checkVC: function(a, b, c, d, e){
    var self = this;
    self.g_need_vcode = !(a == '0');  // 0代表无需验证码
    self.g_vcode = { result: b };
    self.g_salt = c;
    self.g_pt_verifysession_v1 = d;
  },

  ptuiCB: function(a, b, c, d, e, f){

    this.logged_obj = {
      login_retcode: a,
      login_redirect_url: c,
      login_nick: f
    };
  },

  get_ptvfsession: function(){
    var self = this;
    if(self.g_pt_verifysession_v1){
      return self.g_pt_verifysession_v1;
    }
    else{
      var reg = /ptvfsession=([^;]+);/ig;
      var reg2 = /verifysession=([^;]+);/ig;

      if(reg.exec(self.cookies)){
        return RegExp.$1;
      }
      else if(reg2.exec(self.cookies)){
        return RegExp.$1;
      }
    }
    return '';
  },

  /**
   * 下载图形验证码
   */
  downloadVcode: function(cap_cd){
    var self = this;
    var url = 'https://ssl.captcha.qq.com/getimage?uin=' + self.qq + '&aid=' + self.g_appid + '&cap_cd=' + cap_cd + '&' + Math.random();

    var header_sent = {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.111 Safari/537.36',
      cookie: self.cookies
    };

    mkdirp(process.cwd() + '/' + self.vcode_dir, function (err) {
      if (err) console.error(err);
      //else console.log('验证码文件夹创建成功!');
    });

    var content = '';
    var protocol = self.getProtocol(url);

    msg = self.qq + 'download vcode';
    file_logger.info(msg);

    protocol.get({
      host:self.getHost(url),
      port:self.getPort(url),
      path:self.getPath(url),
      headers: header_sent
    }, function(res){
      res.setEncoding('binary');
      //var status = res.statusCode;
      var headers = res.headers;
      self.cookies = cookie_util.merge_cookie(self.cookies, headers["set-cookie"]);

      res.on('data',function(chunk){
        content += chunk;
      });
      res.on('end',function(){
        var resp = new Buffer(content,'binary');

        fs.writeFile( process.cwd() + '/' + self.vcode_dir + '/' + self.qq + '.jpg', resp, function(e) {
          self.ysdm();
          /*if(typeof callback === 'function'){
            callback(e);
          }*/

        });
      });
    })

  },

  getProtocol: function(url){
    return url.substring(0,url.indexOf(":")) === 'https' ? https : http;
  },

  getPort: function(url) {
    var hostPattern = /\w+:\/\/([^\/]+)(\/)?/i;
    var domain = url.match(hostPattern);

    var pos = domain[1].indexOf(":");
    if(pos !== -1) {
      domain[1] = domain[1].substr(pos + 1);
      return parseInt(domain[1]);
    } else if(url.toLowerCase().substr(0, 5) === "https") return 443;
    else return 80;
  },

  //Parse the url,get the host name
  //e.g. http://www.google.com/path/another -> www.google.com
  getHost: function(url){
    var hostPattern = /\w+:\/\/([^\/]+)(\/)?/i;
    var domain = url.match(hostPattern);

    var pos = domain[1].indexOf(":");
    if(pos !== -1) {
      domain[1] = domain[1].substring(0, pos);
    }
    return domain[1];
  },

  //Parse the url,get the path
  //e.g. http://www.google.com/path/another -> /path/another
  getPath: function(url){
    var pathPattern = /\w+:\/\/([^\/]+)(\/.+)(\/$)?/i;
    var fullPath = url.match(pathPattern);
    return fullPath?fullPath[2]:'/';
  },

  /**
   * * 云速打码 http 接口(上传)，node.js 示例代码
   */
  ysdm: function(){
    var self = this;
    var filename = process.cwd() + '/' + self.vcode_dir + '/' + self.qq + '.jpg';

    msg = self.qq + ',ysdm';
    file_logger.info(msg);

    rest.post('http://api.ysdm.net/create.json', {
      multipart: true,
      data: {
        'username': self.conf.username,
        'password': self.conf.password,
        'typeid': self.conf.typeid,
        'softid': self.conf.softid,
        'softkey': self.conf.softkey,
        'image': rest.file(filename, null, fs.statSync(filename).size, null, 'image/gif') // filename: 抓取回来的码证码文件
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
        'Content-Type' : 'application/x-www-form-urlencoded'
      }
    }).on('complete', function(data) {
      var captcha = JSON.parse(data);
      self.g_vcode.result = captcha.Result;
      self.g_vcode.ysdm_id = captcha.Id;

      msg = '验证码识别结果为：' + self.g_vcode.result;
      console_logger.info(msg);
      file_logger.info(msg);

      var ptvfsession = self.get_ptvfsession();
      var p = encoder.encode(self.pwd, self.g_salt, self.g_vcode.result);
      self.postToLogin(ptvfsession, p);

    });
  },


  ysdm_report_err: function(ysdm_id){

    var self = this;
    msg = self.qq + ',ysdm_report_err';
    file_logger.info(msg);

    rest.post('http://api.ysdm.net/reporterror.json', {
      multipart: false,
      data: {
        'username': self.conf.username,
        'password': self.conf.password,
        'softid': self.conf.softid,
        'softkey': self.conf.softkey,
        'id': ysdm_id
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
        'Content-Type' : 'application/x-www-form-urlencoded'
      }
    }).on('complete', function(data) {

      msg = '【id】' + ysdm_id + '已经报错，报错结果：' + data;
      console_logger.info(msg);
      file_logger.info(msg);

    });
  }

};

module.exports = qqmail;