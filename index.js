var encoder = require("./lib/c_login_2_10135.modified.js");
var nodegrass = require("nodegrass");
var http = require('http');
var https = require('https');
var mkdirp = require('mkdirp');
var fs = require("fs");
var rest 	 = require('restler')

var qqmail = {

  qq: null,
  pwd: null,
  cookies: null,

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
    result: null
  },
  vcode_dir: 'vcode_img',
  conf_file: 'qqmail.json',


  temp:{

  },


  /**
   * 登陆成功后，将cookies暂存到本地文件
   * 如：88306691cookies.txt
   */
  saveCookies: function(){

  },



  /**
   * 登陆qq邮箱
   * @param qq
   * @param pwd
   */
  login: function(qq, pwd){
    console.log('QQ:' + qq + ' 开始登陆 ...');
    this.qq = qq;
    this.pwd = pwd;

    this.visitIndex();

    //console.log('e:' + encoder.encode('Zhang*3o38', 'gsgsg', '$3321'))

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

    nodegrass.get(self.temp.iframe, function(data, status, headers){

      self.cookies = headers["set-cookie"];
      console.log(self.cookies);

      var login_sig_reg = /pt_login_sig=([^;]+)/;

      if(login_sig_reg.exec(self.cookies) != null){
        self.g_login_sig = RegExp.$1;
        //console.log('g_login_sig: ' + self.g_login_sig);
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
        console.log('what the fuck, ptui is not found.');
      }


    }, headers_sent, "utf8").on('error', function(e) {
      console.log("Got error: " + e.message);
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
      "Host": "ssl.ptlogin2.qq.com",
      "Referer": "https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=" + self.g_appid + "&daid=" + self.g_daid
      + "&s_url=https://mail.qq.com/cgi-bin/login?vt=passport%26vm=wpt%26ft=loginpage%26target=&style=" + self.g_style
      + "&low_login=1&proxy_url=https://mail.qq.com/proxy.html&need_qr=0&;hide_border=1&border_radius=0"
      + "&self_regurl=http://zc.qq.com/chs/index.html?type=1&app_id=11005?t=regist"
      + "&pt_feedback_link=http://support.qq.com/discuss/350_1.shtml"
      + "&css=https://res.mail.qq.com/zh_CN/htmledition/style/ptlogin_input24e6b9.css",
      "cookie": self.cookies
    };

    nodegrass.get(url, function(data, status, headers){
      console.log(data);
      self.cookies = self.cookies.concat(headers["set-cookie"]);

    }, header_sent, "utf8");
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

    nodegrass.get(url, function(data, status, headers){
      // 执行ptui_checkVC
      eval('self.' + data);

      self.cookies = self.cookies.concat(headers["set-cookie"]);

      // 无需图形验证码
      if(!self.g_need_vcode){
        var ptvfsession = self.get_ptvfsession();
        var p = encoder.encode(self.pwd, self.g_salt, self.g_vcode.result);
        self.postToLogin(ptvfsession, p);
      }
      else{
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
      if (err) console.error(err)
      else console.log('pow!')
    });

    var content = '';
    var protocol = self.getProtocol(url);

    console.log('download');
    protocol.get({
      host:self.getHost(url),
      port:self.getPort(url),
      path:self.getPath(url),
      headers: header_sent
    }, function(res){
      res.setEncoding('binary');
      //var status = res.statusCode;
      var headers = res.headers;
      self.cookies = self.cookies.concat(headers["set-cookie"]);

      res.on('data',function(chunk){
        content += chunk;
      });
      res.on('end',function(){
        var resp = new Buffer(content,'binary');

        fs.writeFile( process.cwd() + '/' + self.vcode_dir + '/' + self.qq + '.jpg', resp, function(e) {
          if(typeof callback === 'function'){
            callback(e);
          }

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
    var filename = self.qq + '.jpg';

    var conf = JSON.parse(fs.readFileSync(process.cwd() + '/' + self.conf_file, "utf-8"));
    rest.post('http://api.ysdm.net/create.json', {
      multipart: true,
      data: {
        'username': conf.username,
        'password': conf.password,
        'typeid': conf.typeid,
        'softid': conf.softid,
        'softkey': conf.softkey,
        'image': rest.file(filename, null, fs.statSync(filename).size, null, 'image/gif') // filename: 抓取回来的码证码文件
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
        'Content-Type' : 'application/x-www-form-urlencoded'
      }
    }).on('complete', function(data) {
      var captcha = JSON.parse(data);
      //console.log('Captcha Encoded.');
      console.log(captcha);
    });
  }

};

module.exports = qqmail;