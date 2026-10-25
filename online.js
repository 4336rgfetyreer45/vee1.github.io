(function() {
  'use strict';
  if (!Array.prototype.find) {
    Array.prototype.find = function(callback, thisArg) {
      for (var i = 0; i < this.length; i++) {
        if (callback.call(thisArg, this[i], i, this)) return this[i];
      }
      return undefined;
    };
  }
  if (!Array.prototype.findIndex) {
    Array.prototype.findIndex = function(callback, thisArg) {
      for (var i = 0; i < this.length; i++) {
        if (callback.call(thisArg, this[i], i, this)) return i;
      }
      return -1;
    };
  }
  if (!Array.prototype.includes) {
    Array.prototype.includes = function(val) {
      return this.indexOf(val) !== -1;
    };
  }
  if (!String.prototype.includes) {
    String.prototype.includes = function(val) {
      return this.indexOf(val) !== -1;
    };
  }
  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(s, pos) {
      pos = pos || 0;
      return this.indexOf(s, pos) === pos;
    };
  }
  if (!String.prototype.endsWith) {
    String.prototype.endsWith = function(s, len) {
      if (len === undefined || len > this.length) len = this.length;
      return this.substring(len - s.length, len) === s;
    };
  }
  if (typeof Promise === 'undefined') {
    window.Promise = function(executor) {
      var self = this;
      self._state = 0;
      self._value = undefined;
      self._handlers = [];
      function resolve(val) {
        if (self._state !== 0) return;
        self._state = 1;
        self._value = val;
        self._handlers.forEach(function(h) { h.onFulfilled(val); });
      }
      function reject(val) {
        if (self._state !== 0) return;
        self._state = 2;
        self._value = val;
        self._handlers.forEach(function(h) { h.onRejected(val); });
      }
      try { executor(resolve, reject); } catch(e) { reject(e); }
    };
    window.Promise.prototype.then = function(onFulfilled, onRejected) {
      var self = this;
      return new Promise(function(resolve, reject) {
        function handle(onFn, fallback) {
          return function(val) {
            try {
              var result = (typeof onFn === 'function') ? onFn(val) : fallback(val);
              if (result && typeof result.then === 'function') result.then(resolve, reject);
              else resolve(result);
            } catch(e) { reject(e); }
          };
        }
        var handler = {
          onFulfilled: handle(onFulfilled, function(v) { return v; }),
          onRejected: handle(onRejected, function(e) { throw e; })
        };
        if (self._state === 1) setTimeout(function() { handler.onFulfilled(self._value); }, 0);
        else if (self._state === 2) setTimeout(function() { handler.onRejected(self._value); }, 0);
        else self._handlers.push(handler);
      });
    };
    window.Promise.prototype['catch'] = function(onRejected) {
      return this.then(null, onRejected);
    };
    window.Promise.resolve = function(val) { return new Promise(function(r) { r(val); }); };
    window.Promise.reject = function(val) { return new Promise(function(_, r) { r(val); }); };
  }
  var Z01_SERVERS = [
    'http://s1.z01.online/',
    'http://s2.z01.online/',
    'http://s3.z01.online/'
  ];
  var Z01_FALLBACK = 'http://z01.online/';
  var Z01_PING_TIMEOUT = 1500;
  function z01Ping(url, callback) {
    var xhr = new XMLHttpRequest();
    var done = false;
    function finish(ok) {
      if (done) return;
      done = true;
      callback(ok);
    }
    try {
      xhr.open('GET', url, true);
      xhr.timeout = Z01_PING_TIMEOUT;
      xhr.onload = function() {
        finish(xhr.status >= 200 && xhr.status < 400);
      };
      xhr.onerror = function() { finish(false); };
      xhr.ontimeout = function() { finish(false); };
      xhr.send();
    } catch (e) {
      finish(false);
    }
  }
  function z01Shuffle(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }
  function z01PickServer(callback) {
    var candidates = z01Shuffle(Z01_SERVERS);
    function tryNext(index) {
      if (index >= candidates.length) {
        callback(Z01_FALLBACK);
        return;
      }
      z01Ping(candidates[index], function(ok) {
        if (ok) {
          callback(candidates[index]);
        } else {
          tryNext(index + 1);
        }
      });
    }
    tryNext(0);
  }
  var online_results_cache = {};
  var ONLINE_CACHE_TTL = 5 * 60 * 1000;
  var Z01_OWN_VAST = [
    { name: 'skaz_two', weight: 70, region: 'ru',
      url: 'https://bid.ctv.house/ads/tag?plc=25&bundle_id={UID}&ifa={GUID}&min_duration=5&max_duration=60&w={WIDTH}&h={HEIGHT}&content_type=avod&video_plcmt=preroll&tmdb_id={MOVIE_IMDB}&genre={MOVIE_GENRES}&cachebuster={TIME}' },
    { name: 'skaz', weight: 55, region: 'ru',
      url: 'https://bid.ctv.house/ads/tag?plc=26&bundle_id={UID}&ifa={GUID}&min_duration=5&max_duration=60&w={WIDTH}&h={HEIGHT}&content_type=avod&video_plcmt=preroll&tmdb_id={MOVIE_IMDB}&genre={MOVIE_GENRES}&cachebuster={TIME}' }
  ];
  function z01PickVast() {
    var sum = 0, i;
    for (i = 0; i < Z01_OWN_VAST.length; i++) sum += Z01_OWN_VAST[i].weight;
    var r = Math.random() * sum;
    for (i = 0; i < Z01_OWN_VAST.length; i++) {
      r -= Z01_OWN_VAST[i].weight;
      if (r < 0) return Z01_OWN_VAST[i];
    }
    return Z01_OWN_VAST[0];
  }
  var Defined = {
    api: 'lampac',
    localhost: 'http://z01.online/',
    apn: ''
  };
  var Z01_FREE = Z01_FALLBACK;
  z01PickServer(function(server) {
    Z01_FREE = server;
    if (Defined.localhost === Z01_FALLBACK) Defined.localhost = server;
  });
  var zprem_dropped = false;
  function zpremDrop(er) {
    if (zprem_dropped) return false;
    if (!er || !er.accsdb) return false;
    if (Defined.localhost !== ZPREM_SERVER) return false;
    zprem_dropped = true;
    Defined.localhost = Z01_FREE;
    return true;
  }
  function arrFind(list, test) {
    if (!list) return undefined;
    for (var i = 0; i < list.length; i++) {
      if (test(list[i], i, list)) return list[i];
    }
    return undefined;
  }
  var balansers_with_search;
  var unic_id = Lampa.Storage.get('lampac_unic_id', '');
  if (!unic_id) {
    unic_id = Lampa.Utils.uid(8).toLowerCase();
    Lampa.Storage.set('lampac_unic_id', unic_id);
  }
    function getAndroidVersion() {
  if (Lampa.Platform.is('android')) {
    try {
      var current = AndroidJS.appVersion().split('-');
      return parseInt(current.pop());
    } catch (e) {
      return 0;
    }
  } else {
    return 0;
  }
}
var hostkey = 'https://z01.online'.replace('http://', '').replace('https://', '');
if (!window.rch_nws || !window.rch_nws[hostkey]) {
  if (!window.rch_nws) window.rch_nws = {};
  window.rch_nws[hostkey] = {
    type: Lampa.Platform.is('android') ? 'apk' : Lampa.Platform.is('tizen') ? 'cors' : undefined,
    startTypeInvoke: false,
    rchRegistry: false,
    apkVersion: getAndroidVersion()
  };
}
window.rch_nws[hostkey].typeInvoke = function rchtypeInvoke(host, call) {
  if (!window.rch_nws[hostkey].startTypeInvoke) {
    window.rch_nws[hostkey].startTypeInvoke = true;
    var check = function check(good) {
      window.rch_nws[hostkey].type = Lampa.Platform.is('android') ? 'apk' : good ? 'cors' : 'web';
      call();
    };
    if (Lampa.Platform.is('android') || Lampa.Platform.is('tizen')) check(true);
    else {
      var net = new Lampa.Reguest();
      net.silent('https://z01.online'.indexOf(location.host) >= 0 ? 'https://github.com/' : host + '/cors/check', function() {
        check(true);
      }, function() {
        check(false);
      }, false, {
        dataType: 'text'
      });
    }
  } else call();
};
window.rch_nws[hostkey].Registry = function RchRegistry(client, startConnection) {
  window.rch_nws[hostkey].typeInvoke('https://z01.online', function() {
    client.invoke("RchRegistry", {
      version: 154,
      host: location.host,
      rchtype: Lampa.Platform.is('android') ? 'apk' : Lampa.Platform.is('tizen') ? 'cors' : (window.rch_nws[hostkey].type || 'web'),
      apkVersion: window.rch_nws[hostkey].apkVersion,
      player: Lampa.Storage.field('player'),
	  account_email: Lampa.Storage.get('account_email', ''),
	  unic_id: Lampa.Storage.get('lampac_unic_id', ''),
	  profile_id: Lampa.Storage.get('lampac_profile_id', ''),
	  token: ''
    });
    if (client._shouldReconnect && window.rch_nws[hostkey].rchRegistry) {
      if (startConnection) startConnection();
      return;
    }
    window.rch_nws[hostkey].rchRegistry = true;
    client.on('RchRegistry', function(clientIp) {
      if (startConnection) startConnection();
    });
    client.on("RchClient", function(rchId, url, data, headers, returnHeaders) {
      var network = new Lampa.Reguest();
	  var rchOrigin = (client && client.url)
	    ? client.url.replace(/^ws(s?):\/\/([^\/?#]+).*/, 'http$1://$2')
	    : 'https://z01.online';
	  function sendResult(uri, html) {
	    $.ajax({
	      url: rchOrigin + '/rch/' + uri + '?id=' + rchId,
	      type: 'POST',
	      data: html,
	      async: true,
	      cache: false,
	      contentType: false,
	      processData: false,
	      success: function(j) {},
	      error: function() {
	        client.invoke("RchResult", rchId, '');
	      }
	    });
	  }
      function result(html) {
        if (Lampa.Arrays.isObject(html) || Lampa.Arrays.isArray(html)) {
          html = JSON.stringify(html);
        }
        if (typeof CompressionStream !== 'undefined' && html && html.length > 2000) {
          var compressionStream = new CompressionStream('gzip');
          var encoder = new TextEncoder();
          var readable = new ReadableStream({
            start: function(controller) {
              controller.enqueue(encoder.encode(html));
              controller.close();
            }
          });
          var compressedStream = readable.pipeThrough(compressionStream);
          new Response(compressedStream).arrayBuffer()
            .then(function(compressedBuffer) {
              var compressedArray = new Uint8Array(compressedBuffer);
              if (compressedArray.length > html.length) {
                sendResult('result', html);
              } else {
                sendResult('gzresult', new Blob([compressedArray], { type: 'application/octet-stream' }));
              }
            })
            .catch(function() {
              sendResult('result', html);
            });
        } else {
          sendResult('result', html);
        }
      }
      if (url == 'eval') {
        result(eval(data));
      } else if (url == 'evalrun') {
        eval(data);
      } else if (url == 'ping') {
        result('pong');
      } else {
        network["native"](url, result, function(e) {
          result('');
        }, data, {
          dataType: 'text',
          timeout: 1000 * 8,
          headers: headers,
          returnHeaders: returnHeaders
        });
      }
    });
    client.on('Connected', function(connectionId) {
      window.rch_nws[hostkey].connectionId = connectionId;
    });
    client.on('Closed', function() {});
    client.on('Error', function(err) {});
  });
};
  window.rch_nws[hostkey].typeInvoke('https://z01.online', function() {});
  function rchInvoke(json, call) {
    if (window.nwsClient && window.nwsClient[hostkey] && window.nwsClient[hostkey]._shouldReconnect){
      call();
      return;
    }
    if (!window.nwsClient) window.nwsClient = {};
    if (window.nwsClient[hostkey] && window.nwsClient[hostkey].socket)
      window.nwsClient[hostkey].socket.close();
    window.nwsClient[hostkey] = new NativeWsClient(json.nws, {
      autoReconnect: false
    });
    window.nwsClient[hostkey].on('Connected', function(connectionId) {
      window.rch_nws[hostkey].Registry(window.nwsClient[hostkey], function() {
        call();
      });
    });
    window.nwsClient[hostkey].connect();
  }
  function rchRun(json, call) {
    if (typeof NativeWsClient == 'undefined') {
      Lampa.Utils.putScript(["https://z01.online/js/nws-client-es5.js?v03022026"], function() {}, false, function() {
        rchInvoke(json, call);
      }, true);
    } else {
      rchInvoke(json, call);
    }
  }
  function account(url) {
    url = url + '';
    if (url.indexOf('account_email=') == -1) {
      var email = Lampa.Storage.get('account_email');
      if (email) url = Lampa.Utils.addUrlComponent(url, 'account_email=' + encodeURIComponent(email));
    }
    if (url.indexOf('uid=') == -1) {
      var uid = Lampa.Storage.get('lampac_unic_id', '');
      if (uid) url = Lampa.Utils.addUrlComponent(url, 'uid=' + encodeURIComponent(uid));
    }
    if (url.indexOf('token=') == -1) {
      var token = '';
      if (token != '') url = Lampa.Utils.addUrlComponent(url, 'token=');
    }
    if (url.indexOf('nws_id=') == -1 && window.rch_nws && window.rch_nws[hostkey]) {
      var nws_id = window.rch_nws[hostkey].connectionId || Lampa.Storage.get('lampac_nws_id', '');
      if (nws_id) url = Lampa.Utils.addUrlComponent(url, 'nws_id=' + encodeURIComponent(nws_id));
    }
    return url;
  }
  var synced_balansers = {};
  function syncBalanser(name) {
    if (!name || synced_balansers[name]) return;
    if (!Lampa.Manifest || Lampa.Manifest.app_digital < 177) return;
    if (!Lampa.Storage.sync) return;
    synced_balansers[name] = true;
    Lampa.Storage.sync('online_choice_' + name, 'object_object');
  }
  var Network = Lampa.Reguest;
  var ZPREM_SERVER = (Lampa.Utils && Lampa.Utils.protocol ? Lampa.Utils.protocol() : 'http://') + 'prem.z01.online/';
  var ZPREM_HOSTS = [
    { host: 'prem.z01.online', k: 1, add: 0 },
    { host: 'cf.z01.online', k: 1.2, add: 100 },
    { host: 'prem2.z01.online', k: 1, add: 0 }
  ];
  var ZPREM_PING_TIMEOUT = 3000;
  var zprem_resolving = false;
  function zpremProto() {
    return Lampa.Utils && Lampa.Utils.protocol ? Lampa.Utils.protocol() : 'http://';
  }
  function zpremUse(host) {
    var server = zpremProto() + host + '/';
    if (server === ZPREM_SERVER) return;
    if (Defined.localhost === ZPREM_SERVER) Defined.localhost = server;
    ZPREM_SERVER = server;
  }
  function zpremMeasure(host, callback) {
    var url = zpremProto() + host + '/lite/withsearch';
    function once(call) {
      var xhr = new XMLHttpRequest();
      var done = false;
      var t0 = Date.now();
      function finish(ok) {
        if (done) return;
        done = true;
        call(ok ? Date.now() - t0 : -1);
      }
      try {
        xhr.open('GET', url + '?_=' + t0, true);
        xhr.timeout = ZPREM_PING_TIMEOUT;
        xhr.onload = function() { finish(xhr.status >= 200 && xhr.status < 400); };
        xhr.onerror = function() { finish(false); };
        xhr.ontimeout = function() { finish(false); };
        xhr.send();
      } catch (e) {
        finish(false);
      }
    }
    once(function(first) {
      if (first < 0) return callback(-1);
      once(function(second) {
        callback(second < 0 ? first : Math.min(first, second));
      });
    });
  }
  function zpremResolve() {
    if (zprem_resolving) return;
    zprem_resolving = true;
    var left = ZPREM_HOSTS.length;
    var best = null;
    ZPREM_HOSTS.forEach(function(h) {
      zpremMeasure(h.host, function(ms) {
        if (ms >= 0) {
          var score = ms * h.k + h.add;
          if (!best || score < best.score) best = { host: h.host, score: score };
        }
        if (--left) return;
        if (!best) return;
        Lampa.Storage.set('zprem_host', best.host);
        zpremUse(best.host);
      });
    });
  }
  (function() {
    var saved = Lampa.Storage.get('zprem_host', '');
    for (var i = 0; i < ZPREM_HOSTS.length; i++) {
      if (ZPREM_HOSTS[i].host === saved) return zpremUse(saved);
    }
  })();
  if (Lampa.Storage.get('zpremkey', '')) zpremResolve();
  var ZPREM_CHECK_URL = (Lampa.Utils && Lampa.Utils.protoc
