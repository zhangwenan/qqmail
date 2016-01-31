var cookie = function(str){
  var paris_reg = /^([^=]+)=([^;]*);/i;
  var paris = str.match(paris_reg);

  this.name = paris[1];
  this.value = paris[2];

  var expires_reg = /EXPIRES=([^;]*);/i;
  var expires = str.match(expires_reg);
  this.expires = expires ? expires[1] : '';

  var path_reg = /PATH=([^;]*);/i;
  var path = str.match(path_reg);
  this.path = path ? path[1] : '';

  var domain_reg = /DOMAIN=([^;]*);/i;
  var domain = str.match(domain_reg);
  this.domain = domain ? domain[1] : '';

  this.http_only = (/HttpOnly/ig).test(str);

  this.equal = function(cookie){
    if(this.name != cookie.name){
      return false;
    }

    if(this.value != cookie.value){
      return false;
    }

    if(this.domain.toLowerCase() != cookie.domain.toLowerCase()){
      return false;
    }

    if(this.path != cookie.path){
      return false;
    }

    return true;
  };

  this.toString = function(){
    var ret = this.name + '=' + this.value + ';';
    if(this.expires){
      ret += ' EXPIRES=' + this.expires + ';';
    }

    if(this.path){
      ret += ' PATH=' + this.path + ';';
    }

    if(this.domain){
      ret += ' DOMAIN=' + this.domain + ';';
    }

    if(this.http_only){
      ret += ' HttpOnly;';
    }

    return ret;
  }

};


/**
 * 合并cookie, 如果有同名cookie，后面的覆盖前面的
 * @param cookie_str_arr1
 * @param cookie_str_arr2
 * @returns {Array}
 */
var merge_cookie = function(cookie_str_arr1, cookie_str_arr2){
  var cookie_arr1 = [];
  for(var i=0; i<cookie_str_arr1.length; i++){
    cookie_arr1.push(new cookie(cookie_str_arr1[i]));
  }

  var temp = [];
  for(var i=0; i<cookie_str_arr2.length; i++){
    var c1 = new cookie(cookie_str_arr2[i]);
    var found = false;

    for(var j=0; j<cookie_arr1.length; j++){
      var c2 = cookie_arr1[j];
      if(c1.equal(c2)){
        found = true;
        break;
      }
      else{
        if(c2.name == c1.name &&
          c2.domain.toLowerCase() == c1.domain.toLowerCase() &&
          c2.path == c1.path &&
          c2.value != c1.value){
          // 域名,目录,cookie名都相同，但是cookie值不同，那么需要合并
          cookie_arr1[j].value = c1.value;
          found = true;
          break;
        }
      }
    }

    if(!found){
      temp.push(c1);
    }
  }

  for(var i=0; i<temp.length; i++){
    cookie_arr1.push(temp[i]);
  }

  var cookie_str_ret = [];
  for(var i=0; i<cookie_arr1.length; i++){
    cookie_str_ret.push(cookie_arr1[i].toString());
  }
  return cookie_str_ret;
};

/**
 * cookie转换
 * e.g ["tinfo=1454245629.0000*; Domain=mail.qq.com; Path=/","wimrefreshrun=0&; Domain=mail.qq.com; Path=/","autologin=; Domain=mail.qq.com; Path=/; Expires=Thu, 01-Jan-1970 00:00:01 GMT"]
 * 转换为： "tinfo=1454245629.0000*; wimrefreshrun=0&; autologin="]
 * @param cookie_str_arr
 * @returns {string}
 */
function get_simple_cookie_str(cookie_str_arr){
  var ret = '';
  var c = null, temp_str;
  for(var i=0; i<cookie_str_arr.length; i++){
    c = new cookie(cookie_str_arr[i]);
    temp_str = c.name + '=' + c.value;
    if(i<cookie_str_arr.length-1){
      temp_str += '; ';
    }
    ret += temp_str;
  }
  return ret;
}

module.exports = {
  merge_cookie: merge_cookie,
  get_simple_cookie_str: get_simple_cookie_str
};