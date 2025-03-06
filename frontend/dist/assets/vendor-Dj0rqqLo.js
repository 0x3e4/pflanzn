import{c as Ae,g as Dr,a as Wn}from"./react-CBdYcQ-l.js";var We={exports:{}},$e={};/**
 * @license React
 * scheduler.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Xt;function Lr(){return Xt||(Xt=1,function(e){function t(h,x){var w=h.length;h.push(x);e:for(;0<w;){var k=w-1>>>1,C=h[k];if(0<a(C,x))h[k]=x,h[w]=C,w=k;else break e}}function n(h){return h.length===0?null:h[0]}function r(h){if(h.length===0)return null;var x=h[0],w=h.pop();if(w!==x){h[0]=w;e:for(var k=0,C=h.length,ne=C>>>1;k<ne;){var $=2*(k+1)-1,se=h[$],G=$+1,ce=h[G];if(0>a(se,w))G<C&&0>a(ce,se)?(h[k]=ce,h[G]=w,k=G):(h[k]=se,h[$]=w,k=$);else if(G<C&&0>a(ce,w))h[k]=ce,h[G]=w,k=G;else break e}}return x}function a(h,x){var w=h.sortIndex-x.sortIndex;return w!==0?w:h.id-x.id}if(e.unstable_now=void 0,typeof performance=="object"&&typeof performance.now=="function"){var i=performance;e.unstable_now=function(){return i.now()}}else{var o=Date,s=o.now();e.unstable_now=function(){return o.now()-s}}var c=[],f=[],d=1,p=null,l=3,v=!1,m=!1,y=!1,E=typeof setTimeout=="function"?setTimeout:null,S=typeof clearTimeout=="function"?clearTimeout:null,_=typeof setImmediate<"u"?setImmediate:null;function P(h){for(var x=n(f);x!==null;){if(x.callback===null)r(f);else if(x.startTime<=h)r(f),x.sortIndex=x.expirationTime,t(c,x);else break;x=n(f)}}function I(h){if(y=!1,P(h),!m)if(n(c)!==null)m=!0,W();else{var x=n(f);x!==null&&oe(I,x.startTime-h)}}var b=!1,O=-1,T=5,R=-1;function j(){return!(e.unstable_now()-R<T)}function q(){if(b){var h=e.unstable_now();R=h;var x=!0;try{e:{m=!1,y&&(y=!1,S(O),O=-1),v=!0;var w=l;try{t:{for(P(h),p=n(c);p!==null&&!(p.expirationTime>h&&j());){var k=p.callback;if(typeof k=="function"){p.callback=null,l=p.priorityLevel;var C=k(p.expirationTime<=h);if(h=e.unstable_now(),typeof C=="function"){p.callback=C,P(h),x=!0;break t}p===n(c)&&r(c),P(h)}else r(c);p=n(c)}if(p!==null)x=!0;else{var ne=n(f);ne!==null&&oe(I,ne.startTime-h),x=!1}}break e}finally{p=null,l=w,v=!1}x=void 0}}finally{x?z():b=!1}}}var z;if(typeof _=="function")z=function(){_(q)};else if(typeof MessageChannel<"u"){var D=new MessageChannel,H=D.port2;D.port1.onmessage=q,z=function(){H.postMessage(null)}}else z=function(){E(q,0)};function W(){b||(b=!0,z())}function oe(h,x){O=E(function(){h(e.unstable_now())},x)}e.unstable_IdlePriority=5,e.unstable_ImmediatePriority=1,e.unstable_LowPriority=4,e.unstable_NormalPriority=3,e.unstable_Profiling=null,e.unstable_UserBlockingPriority=2,e.unstable_cancelCallback=function(h){h.callback=null},e.unstable_continueExecution=function(){m||v||(m=!0,W())},e.unstable_forceFrameRate=function(h){0>h||125<h?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):T=0<h?Math.floor(1e3/h):5},e.unstable_getCurrentPriorityLevel=function(){return l},e.unstable_getFirstCallbackNode=function(){return n(c)},e.unstable_next=function(h){switch(l){case 1:case 2:case 3:var x=3;break;default:x=l}var w=l;l=x;try{return h()}finally{l=w}},e.unstable_pauseExecution=function(){},e.unstable_requestPaint=function(){},e.unstable_runWithPriority=function(h,x){switch(h){case 1:case 2:case 3:case 4:case 5:break;default:h=3}var w=l;l=h;try{return x()}finally{l=w}},e.unstable_scheduleCallback=function(h,x,w){var k=e.unstable_now();switch(typeof w=="object"&&w!==null?(w=w.delay,w=typeof w=="number"&&0<w?k+w:k):w=k,h){case 1:var C=-1;break;case 2:C=250;break;case 5:C=1073741823;break;case 4:C=1e4;break;default:C=5e3}return C=w+C,h={id:d++,callback:x,priorityLevel:h,startTime:w,expirationTime:C,sortIndex:-1},w>k?(h.sortIndex=w,t(f,h),n(c)===null&&h===n(f)&&(y?(S(O),O=-1):y=!0,oe(I,w-k))):(h.sortIndex=C,t(c,h),m||v||(m=!0,W())),h},e.unstable_shouldYield=j,e.unstable_wrapCallback=function(h){var x=l;return function(){var w=l;l=x;try{return h.apply(this,arguments)}finally{l=w}}}}($e)),$e}var Qt;function No(){return Qt||(Qt=1,We.exports=Lr()),We.exports}var pe={},Kt;function zr(){if(Kt)return pe;Kt=1,Object.defineProperty(pe,"__esModule",{value:!0}),pe.parse=o,pe.serialize=f;const e=/^[\u0021-\u003A\u003C\u003E-\u007E]+$/,t=/^[\u0021-\u003A\u003C-\u007E]*$/,n=/^([.]?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)([.][a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i,r=/^[\u0020-\u003A\u003D-\u007E]*$/,a=Object.prototype.toString,i=(()=>{const l=function(){};return l.prototype=Object.create(null),l})();function o(l,v){const m=new i,y=l.length;if(y<2)return m;const E=(v==null?void 0:v.decode)||d;let S=0;do{const _=l.indexOf("=",S);if(_===-1)break;const P=l.indexOf(";",S),I=P===-1?y:P;if(_>I){S=l.lastIndexOf(";",_-1)+1;continue}const b=s(l,S,_),O=c(l,_,b),T=l.slice(b,O);if(m[T]===void 0){let R=s(l,_+1,I),j=c(l,I,R);const q=E(l.slice(R,j));m[T]=q}S=I+1}while(S<y);return m}function s(l,v,m){do{const y=l.charCodeAt(v);if(y!==32&&y!==9)return v}while(++v<m);return m}function c(l,v,m){for(;v>m;){const y=l.charCodeAt(--v);if(y!==32&&y!==9)return v+1}return m}function f(l,v,m){const y=(m==null?void 0:m.encode)||encodeURIComponent;if(!e.test(l))throw new TypeError(`argument name is invalid: ${l}`);const E=y(v);if(!t.test(E))throw new TypeError(`argument val is invalid: ${v}`);let S=l+"="+E;if(!m)return S;if(m.maxAge!==void 0){if(!Number.isInteger(m.maxAge))throw new TypeError(`option maxAge is invalid: ${m.maxAge}`);S+="; Max-Age="+m.maxAge}if(m.domain){if(!n.test(m.domain))throw new TypeError(`option domain is invalid: ${m.domain}`);S+="; Domain="+m.domain}if(m.path){if(!r.test(m.path))throw new TypeError(`option path is invalid: ${m.path}`);S+="; Path="+m.path}if(m.expires){if(!p(m.expires)||!Number.isFinite(m.expires.valueOf()))throw new TypeError(`option expires is invalid: ${m.expires}`);S+="; Expires="+m.expires.toUTCString()}if(m.httpOnly&&(S+="; HttpOnly"),m.secure&&(S+="; Secure"),m.partitioned&&(S+="; Partitioned"),m.priority)switch(typeof m.priority=="string"?m.priority.toLowerCase():void 0){case"low":S+="; Priority=Low";break;case"medium":S+="; Priority=Medium";break;case"high":S+="; Priority=High";break;default:throw new TypeError(`option priority is invalid: ${m.priority}`)}if(m.sameSite)switch(typeof m.sameSite=="string"?m.sameSite.toLowerCase():m.sameSite){case!0:case"strict":S+="; SameSite=Strict";break;case"lax":S+="; SameSite=Lax";break;case"none":S+="; SameSite=None";break;default:throw new TypeError(`option sameSite is invalid: ${m.sameSite}`)}return S}function d(l){if(l.indexOf("%")===-1)return l;try{return decodeURIComponent(l)}catch{return l}}function p(l){return a.call(l)==="[object Date]"}return pe}zr();var Ge,Jt;function Fo(){if(Jt)return Ge;Jt=1;var e="Expected a function",t=NaN,n="[object Symbol]",r=/^\s+|\s+$/g,a=/^[-+]0x[0-9a-f]+$/i,i=/^0b[01]+$/i,o=/^0o[0-7]+$/i,s=parseInt,c=typeof Ae=="object"&&Ae&&Ae.Object===Object&&Ae,f=typeof self=="object"&&self&&self.Object===Object&&self,d=c||f||Function("return this")(),p=Object.prototype,l=p.toString,v=Math.max,m=Math.min,y=function(){return d.Date.now()};function E(b,O,T){var R,j,q,z,D,H,W=0,oe=!1,h=!1,x=!0;if(typeof b!="function")throw new TypeError(e);O=I(O)||0,S(T)&&(oe=!!T.leading,h="maxWait"in T,q=h?v(I(T.maxWait)||0,O):q,x="trailing"in T?!!T.trailing:x);function w(M){var K=R,he=j;return R=j=void 0,W=M,z=b.apply(he,K),z}function k(M){return W=M,D=setTimeout($,O),oe?w(M):z}function C(M){var K=M-H,he=M-W,Bt=O-K;return h?m(Bt,q-he):Bt}function ne(M){var K=M-H,he=M-W;return H===void 0||K>=O||K<0||h&&he>=q}function $(){var M=y();if(ne(M))return se(M);D=setTimeout($,C(M))}function se(M){return D=void 0,x&&R?w(M):(R=j=void 0,z)}function G(){D!==void 0&&clearTimeout(D),W=0,R=H=j=D=void 0}function ce(){return D===void 0?z:se(y())}function He(){var M=y(),K=ne(M);if(R=arguments,j=this,H=M,K){if(D===void 0)return k(H);if(h)return D=setTimeout($,O),w(H)}return D===void 0&&(D=setTimeout($,O)),z}return He.cancel=G,He.flush=ce,He}function S(b){var O=typeof b;return!!b&&(O=="object"||O=="function")}function _(b){return!!b&&typeof b=="object"}function P(b){return typeof b=="symbol"||_(b)&&l.call(b)==n}function I(b){if(typeof b=="number")return b;if(P(b))return t;if(S(b)){var O=typeof b.valueOf=="function"?b.valueOf():b;b=S(O)?O+"":O}if(typeof b!="string")return b===0?b:+b;b=b.replace(r,"");var T=i.test(b);return T||o.test(b)?s(b.slice(2),T?2:8):a.test(b)?t:+b}return Ge=E,Ge}var Ve={exports:{}};/*!
	Copyright (c) 2018 Jed Watson.
	Licensed under the MIT License (MIT), see
	http://jedwatson.github.io/classnames
*/var Zt;function Ro(){return Zt||(Zt=1,function(e){(function(){var t={}.hasOwnProperty;function n(){for(var i="",o=0;o<arguments.length;o++){var s=arguments[o];s&&(i=a(i,r(s)))}return i}function r(i){if(typeof i=="string"||typeof i=="number")return i;if(typeof i!="object")return"";if(Array.isArray(i))return n.apply(null,i);if(i.toString!==Object.prototype.toString&&!i.toString.toString().includes("[native code]"))return i.toString();var o="";for(var s in i)t.call(i,s)&&i[s]&&(o=a(o,s));return o}function a(i,o){return o?i?i+" "+o:i+o:i}e.exports?(n.default=n,e.exports=n):window.classNames=n})()}(Ve)),Ve.exports}var $n=function(){if(typeof Map<"u")return Map;function e(t,n){var r=-1;return t.some(function(a,i){return a[0]===n?(r=i,!0):!1}),r}return function(){function t(){this.__entries__=[]}return Object.defineProperty(t.prototype,"size",{get:function(){return this.__entries__.length},enumerable:!0,configurable:!0}),t.prototype.get=function(n){var r=e(this.__entries__,n),a=this.__entries__[r];return a&&a[1]},t.prototype.set=function(n,r){var a=e(this.__entries__,n);~a?this.__entries__[a][1]=r:this.__entries__.push([n,r])},t.prototype.delete=function(n){var r=this.__entries__,a=e(r,n);~a&&r.splice(a,1)},t.prototype.has=function(n){return!!~e(this.__entries__,n)},t.prototype.clear=function(){this.__entries__.splice(0)},t.prototype.forEach=function(n,r){r===void 0&&(r=null);for(var a=0,i=this.__entries__;a<i.length;a++){var o=i[a];n.call(r,o[1],o[0])}},t}()}(),dt=typeof window<"u"&&typeof document<"u"&&window.document===document,Ie=function(){return typeof global<"u"&&global.Math===Math?global:typeof self<"u"&&self.Math===Math?self:typeof window<"u"&&window.Math===Math?window:Function("return this")()}(),jr=function(){return typeof requestAnimationFrame=="function"?requestAnimationFrame.bind(Ie):function(e){return setTimeout(function(){return e(Date.now())},1e3/60)}}(),qr=2;function Yr(e,t){var n=!1,r=!1,a=0;function i(){n&&(n=!1,e()),r&&s()}function o(){jr(i)}function s(){var c=Date.now();if(n){if(c-a<qr)return;r=!0}else n=!0,r=!1,setTimeout(o,t);a=c}return s}var Ur=20,Hr=["top","right","bottom","left","width","height","size","weight"],Wr=typeof MutationObserver<"u",$r=function(){function e(){this.connected_=!1,this.mutationEventsAdded_=!1,this.mutationsObserver_=null,this.observers_=[],this.onTransitionEnd_=this.onTransitionEnd_.bind(this),this.refresh=Yr(this.refresh.bind(this),Ur)}return e.prototype.addObserver=function(t){~this.observers_.indexOf(t)||this.observers_.push(t),this.connected_||this.connect_()},e.prototype.removeObserver=function(t){var n=this.observers_,r=n.indexOf(t);~r&&n.splice(r,1),!n.length&&this.connected_&&this.disconnect_()},e.prototype.refresh=function(){var t=this.updateObservers_();t&&this.refresh()},e.prototype.updateObservers_=function(){var t=this.observers_.filter(function(n){return n.gatherActive(),n.hasActive()});return t.forEach(function(n){return n.broadcastActive()}),t.length>0},e.prototype.connect_=function(){!dt||this.connected_||(document.addEventListener("transitionend",this.onTransitionEnd_),window.addEventListener("resize",this.refresh),Wr?(this.mutationsObserver_=new MutationObserver(this.refresh),this.mutationsObserver_.observe(document,{attributes:!0,childList:!0,characterData:!0,subtree:!0})):(document.addEventListener("DOMSubtreeModified",this.refresh),this.mutationEventsAdded_=!0),this.connected_=!0)},e.prototype.disconnect_=function(){!dt||!this.connected_||(document.removeEventListener("transitionend",this.onTransitionEnd_),window.removeEventListener("resize",this.refresh),this.mutationsObserver_&&this.mutationsObserver_.disconnect(),this.mutationEventsAdded_&&document.removeEventListener("DOMSubtreeModified",this.refresh),this.mutationsObserver_=null,this.mutationEventsAdded_=!1,this.connected_=!1)},e.prototype.onTransitionEnd_=function(t){var n=t.propertyName,r=n===void 0?"":n,a=Hr.some(function(i){return!!~r.indexOf(i)});a&&this.refresh()},e.getInstance=function(){return this.instance_||(this.instance_=new e),this.instance_},e.instance_=null,e}(),Gn=function(e,t){for(var n=0,r=Object.keys(t);n<r.length;n++){var a=r[n];Object.defineProperty(e,a,{value:t[a],enumerable:!1,writable:!1,configurable:!0})}return e},ue=function(e){var t=e&&e.ownerDocument&&e.ownerDocument.defaultView;return t||Ie},Vn=De(0,0,0,0);function Ne(e){return parseFloat(e)||0}function en(e){for(var t=[],n=1;n<arguments.length;n++)t[n-1]=arguments[n];return t.reduce(function(r,a){var i=e["border-"+a+"-width"];return r+Ne(i)},0)}function Gr(e){for(var t=["top","right","bottom","left"],n={},r=0,a=t;r<a.length;r++){var i=a[r],o=e["padding-"+i];n[i]=Ne(o)}return n}function Vr(e){var t=e.getBBox();return De(0,0,t.width,t.height)}function Br(e){var t=e.clientWidth,n=e.clientHeight;if(!t&&!n)return Vn;var r=ue(e).getComputedStyle(e),a=Gr(r),i=a.left+a.right,o=a.top+a.bottom,s=Ne(r.width),c=Ne(r.height);if(r.boxSizing==="border-box"&&(Math.round(s+i)!==t&&(s-=en(r,"left","right")+i),Math.round(c+o)!==n&&(c-=en(r,"top","bottom")+o)),!Qr(e)){var f=Math.round(s+i)-t,d=Math.round(c+o)-n;Math.abs(f)!==1&&(s-=f),Math.abs(d)!==1&&(c-=d)}return De(a.left,a.top,s,c)}var Xr=function(){return typeof SVGGraphicsElement<"u"?function(e){return e instanceof ue(e).SVGGraphicsElement}:function(e){return e instanceof ue(e).SVGElement&&typeof e.getBBox=="function"}}();function Qr(e){return e===ue(e).document.documentElement}function Kr(e){return dt?Xr(e)?Vr(e):Br(e):Vn}function Jr(e){var t=e.x,n=e.y,r=e.width,a=e.height,i=typeof DOMRectReadOnly<"u"?DOMRectReadOnly:Object,o=Object.create(i.prototype);return Gn(o,{x:t,y:n,width:r,height:a,top:n,right:t+r,bottom:a+n,left:t}),o}function De(e,t,n,r){return{x:e,y:t,width:n,height:r}}var Zr=function(){function e(t){this.broadcastWidth=0,this.broadcastHeight=0,this.contentRect_=De(0,0,0,0),this.target=t}return e.prototype.isActive=function(){var t=Kr(this.target);return this.contentRect_=t,t.width!==this.broadcastWidth||t.height!==this.broadcastHeight},e.prototype.broadcastRect=function(){var t=this.contentRect_;return this.broadcastWidth=t.width,this.broadcastHeight=t.height,t},e}(),ea=function(){function e(t,n){var r=Jr(n);Gn(this,{target:t,contentRect:r})}return e}(),ta=function(){function e(t,n,r){if(this.activeObservations_=[],this.observations_=new $n,typeof t!="function")throw new TypeError("The callback provided as parameter 1 is not a function.");this.callback_=t,this.controller_=n,this.callbackCtx_=r}return e.prototype.observe=function(t){if(!arguments.length)throw new TypeError("1 argument required, but only 0 present.");if(!(typeof Element>"u"||!(Element instanceof Object))){if(!(t instanceof ue(t).Element))throw new TypeError('parameter 1 is not of type "Element".');var n=this.observations_;n.has(t)||(n.set(t,new Zr(t)),this.controller_.addObserver(this),this.controller_.refresh())}},e.prototype.unobserve=function(t){if(!arguments.length)throw new TypeError("1 argument required, but only 0 present.");if(!(typeof Element>"u"||!(Element instanceof Object))){if(!(t instanceof ue(t).Element))throw new TypeError('parameter 1 is not of type "Element".');var n=this.observations_;n.has(t)&&(n.delete(t),n.size||this.controller_.removeObserver(this))}},e.prototype.disconnect=function(){this.clearActive(),this.observations_.clear(),this.controller_.removeObserver(this)},e.prototype.gatherActive=function(){var t=this;this.clearActive(),this.observations_.forEach(function(n){n.isActive()&&t.activeObservations_.push(n)})},e.prototype.broadcastActive=function(){if(this.hasActive()){var t=this.callbackCtx_,n=this.activeObservations_.map(function(r){return new ea(r.target,r.broadcastRect())});this.callback_.call(t,n,t),this.clearActive()}},e.prototype.clearActive=function(){this.activeObservations_.splice(0)},e.prototype.hasActive=function(){return this.activeObservations_.length>0},e}(),Bn=typeof WeakMap<"u"?new WeakMap:new $n,Xn=function(){function e(t){if(!(this instanceof e))throw new TypeError("Cannot call a class as a function.");if(!arguments.length)throw new TypeError("1 argument required, but only 0 present.");var n=$r.getInstance(),r=new ta(t,n,this);Bn.set(this,r)}return e}();["observe","unobserve","disconnect"].forEach(function(e){Xn.prototype[e]=function(){var t;return(t=Bn.get(this))[e].apply(t,arguments)}});var na=function(){return typeof Ie.ResizeObserver<"u"?Ie.ResizeObserver:Xn}();const ra=Object.freeze(Object.defineProperty({__proto__:null,default:na},Symbol.toStringTag,{value:"Module"})),Do=Dr(ra);var Be,tn;function aa(){if(tn)return Be;tn=1;var e=function(t){return t.replace(/[A-Z]/g,function(n){return"-"+n.toLowerCase()}).toLowerCase()};return Be=e,Be}var Xe,nn;function Lo(){if(nn)return Xe;nn=1;var e=aa(),t=function(a){var i=/[height|width]$/;return i.test(a)},n=function(a){var i="",o=Object.keys(a);return o.forEach(function(s,c){var f=a[s];s=e(s),t(s)&&typeof f=="number"&&(f=f+"px"),f===!0?i+=s:f===!1?i+="not "+s:i+="("+s+": "+f+")",c<o.length-1&&(i+=" and ")}),i},r=function(a){var i="";return typeof a=="string"?a:a instanceof Array?(a.forEach(function(o,s){i+=n(o),s<a.length-1&&(i+=", ")}),i):n(a)};return Xe=r,Xe}var Qe,rn;function ia(){if(rn)return Qe;rn=1;function e(t){this.options=t,!t.deferSetup&&this.setup()}return e.prototype={constructor:e,setup:function(){this.options.setup&&this.options.setup(),this.initialised=!0},on:function(){!this.initialised&&this.setup(),this.options.match&&this.options.match()},off:function(){this.options.unmatch&&this.options.unmatch()},destroy:function(){this.options.destroy?this.options.destroy():this.off()},equals:function(t){return this.options===t||this.options.match===t}},Qe=e,Qe}var Ke,an;function Qn(){if(an)return Ke;an=1;function e(r,a){var i=0,o=r.length,s;for(i;i<o&&(s=a(r[i],i),s!==!1);i++);}function t(r){return Object.prototype.toString.apply(r)==="[object Array]"}function n(r){return typeof r=="function"}return Ke={isFunction:n,isArray:t,each:e},Ke}var Je,on;function oa(){if(on)return Je;on=1;var e=ia(),t=Qn().each;function n(r,a){this.query=r,this.isUnconditional=a,this.handlers=[],this.mql=window.matchMedia(r);var i=this;this.listener=function(o){i.mql=o.currentTarget||o,i.assess()},this.mql.addListener(this.listener)}return n.prototype={constuctor:n,addHandler:function(r){var a=new e(r);this.handlers.push(a),this.matches()&&a.on()},removeHandler:function(r){var a=this.handlers;t(a,function(i,o){if(i.equals(r))return i.destroy(),!a.splice(o,1)})},matches:function(){return this.mql.matches||this.isUnconditional},clear:function(){t(this.handlers,function(r){r.destroy()}),this.mql.removeListener(this.listener),this.handlers.length=0},assess:function(){var r=this.matches()?"on":"off";t(this.handlers,function(a){a[r]()})}},Je=n,Je}var Ze,sn;function sa(){if(sn)return Ze;sn=1;var e=oa(),t=Qn(),n=t.each,r=t.isFunction,a=t.isArray;function i(){if(!window.matchMedia)throw new Error("matchMedia not present, legacy browsers require a polyfill");this.queries={},this.browserIsIncapable=!window.matchMedia("only all").matches}return i.prototype={constructor:i,register:function(o,s,c){var f=this.queries,d=c&&this.browserIsIncapable;return f[o]||(f[o]=new e(o,d)),r(s)&&(s={match:s}),a(s)||(s=[s]),n(s,function(p){r(p)&&(p={match:p}),f[o].addHandler(p)}),this},unregister:function(o,s){var c=this.queries[o];return c&&(s?c.removeHandler(s):(c.clear(),delete this.queries[o])),this}},Ze=i,Ze}var et,cn;function zo(){if(cn)return et;cn=1;var e=sa();return et=new e,et}function Kn(e){var t,n,r="";if(typeof e=="string"||typeof e=="number")r+=e;else if(typeof e=="object")if(Array.isArray(e)){var a=e.length;for(t=0;t<a;t++)e[t]&&(n=Kn(e[t]))&&(r&&(r+=" "),r+=n)}else for(n in e)e[n]&&(r&&(r+=" "),r+=n);return r}function jo(){for(var e,t,n=0,r="",a=arguments.length;n<a;n++)(e=arguments[n])&&(t=Kn(e))&&(r&&(r+=" "),r+=t);return r}/*!
 * Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com
 * License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License)
 * Copyright 2024 Fonticons, Inc.
 */function ca(e,t,n){return(t=la(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function fn(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter(function(a){return Object.getOwnPropertyDescriptor(e,a).enumerable})),n.push.apply(n,r)}return n}function u(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]!=null?arguments[t]:{};t%2?fn(Object(n),!0).forEach(function(r){ca(e,r,n[r])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):fn(Object(n)).forEach(function(r){Object.defineProperty(e,r,Object.getOwnPropertyDescriptor(n,r))})}return e}function fa(e,t){if(typeof e!="object"||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t);if(typeof r!="object")return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return(t==="string"?String:Number)(e)}function la(e){var t=fa(e,"string");return typeof t=="symbol"?t:t+""}const ln=()=>{};let Tt={},Jn={},Zn=null,er={mark:ln,measure:ln};try{typeof window<"u"&&(Tt=window),typeof document<"u"&&(Jn=document),typeof MutationObserver<"u"&&(Zn=MutationObserver),typeof performance<"u"&&(er=performance)}catch{}const{userAgent:un=""}=Tt.navigator||{},Z=Tt,A=Jn,dn=Zn,ke=er;Z.document;const X=!!A.documentElement&&!!A.head&&typeof A.addEventListener=="function"&&typeof A.createElement=="function",tr=~un.indexOf("MSIE")||~un.indexOf("Trident/");var ua=/fa(s|r|l|t|d|dr|dl|dt|b|k|kd|ss|sr|sl|st|sds|sdr|sdl|sdt)?[\-\ ]/,da=/Font ?Awesome ?([56 ]*)(Solid|Regular|Light|Thin|Duotone|Brands|Free|Pro|Sharp Duotone|Sharp|Kit)?.*/i,nr={classic:{fa:"solid",fas:"solid","fa-solid":"solid",far:"regular","fa-regular":"regular",fal:"light","fa-light":"light",fat:"thin","fa-thin":"thin",fab:"brands","fa-brands":"brands"},duotone:{fa:"solid",fad:"solid","fa-solid":"solid","fa-duotone":"solid",fadr:"regular","fa-regular":"regular",fadl:"light","fa-light":"light",fadt:"thin","fa-thin":"thin"},sharp:{fa:"solid",fass:"solid","fa-solid":"solid",fasr:"regular","fa-regular":"regular",fasl:"light","fa-light":"light",fast:"thin","fa-thin":"thin"},"sharp-duotone":{fa:"solid",fasds:"solid","fa-solid":"solid",fasdr:"regular","fa-regular":"regular",fasdl:"light","fa-light":"light",fasdt:"thin","fa-thin":"thin"}},ma={GROUP:"duotone-group",PRIMARY:"primary",SECONDARY:"secondary"},rr=["fa-classic","fa-duotone","fa-sharp","fa-sharp-duotone"],N="classic",Le="duotone",ha="sharp",pa="sharp-duotone",ar=[N,Le,ha,pa],ga={classic:{900:"fas",400:"far",normal:"far",300:"fal",100:"fat"},duotone:{900:"fad",400:"fadr",300:"fadl",100:"fadt"},sharp:{900:"fass",400:"fasr",300:"fasl",100:"fast"},"sharp-duotone":{900:"fasds",400:"fasdr",300:"fasdl",100:"fasdt"}},va={"Font Awesome 6 Free":{900:"fas",400:"far"},"Font Awesome 6 Pro":{900:"fas",400:"far",normal:"far",300:"fal",100:"fat"},"Font Awesome 6 Brands":{400:"fab",normal:"fab"},"Font Awesome 6 Duotone":{900:"fad",400:"fadr",normal:"fadr",300:"fadl",100:"fadt"},"Font Awesome 6 Sharp":{900:"fass",400:"fasr",normal:"fasr",300:"fasl",100:"fast"},"Font Awesome 6 Sharp Duotone":{900:"fasds",400:"fasdr",normal:"fasdr",300:"fasdl",100:"fasdt"}},ya=new Map([["classic",{defaultShortPrefixId:"fas",defaultStyleId:"solid",styleIds:["solid","regular","light","thin","brands"],futureStyleIds:[],defaultFontWeight:900}],["sharp",{defaultShortPrefixId:"fass",defaultStyleId:"solid",styleIds:["solid","regular","light","thin"],futureStyleIds:[],defaultFontWeight:900}],["duotone",{defaultShortPrefixId:"fad",defaultStyleId:"solid",styleIds:["solid","regular","light","thin"],futureStyleIds:[],defaultFontWeight:900}],["sharp-duotone",{defaultShortPrefixId:"fasds",defaultStyleId:"solid",styleIds:["solid","regular","light","thin"],futureStyleIds:[],defaultFontWeight:900}]]),ba={classic:{solid:"fas",regular:"far",light:"fal",thin:"fat",brands:"fab"},duotone:{solid:"fad",regular:"fadr",light:"fadl",thin:"fadt"},sharp:{solid:"fass",regular:"fasr",light:"fasl",thin:"fast"},"sharp-duotone":{solid:"fasds",regular:"fasdr",light:"fasdl",thin:"fasdt"}},wa=["fak","fa-kit","fakd","fa-kit-duotone"],mn={kit:{fak:"kit","fa-kit":"kit"},"kit-duotone":{fakd:"kit-duotone","fa-kit-duotone":"kit-duotone"}},xa=["kit"],Sa={kit:{"fa-kit":"fak"}},Ea=["fak","fakd"],_a={kit:{fak:"fa-kit"}},hn={kit:{kit:"fak"},"kit-duotone":{"kit-duotone":"fakd"}},Pe={GROUP:"duotone-group",SWAP_OPACITY:"swap-opacity",PRIMARY:"primary",SECONDARY:"secondary"},Oa=["fa-classic","fa-duotone","fa-sharp","fa-sharp-duotone"],Aa=["fak","fa-kit","fakd","fa-kit-duotone"],ka={"Font Awesome Kit":{400:"fak",normal:"fak"},"Font Awesome Kit Duotone":{400:"fakd",normal:"fakd"}},Pa={classic:{"fa-brands":"fab","fa-duotone":"fad","fa-light":"fal","fa-regular":"far","fa-solid":"fas","fa-thin":"fat"},duotone:{"fa-regular":"fadr","fa-light":"fadl","fa-thin":"fadt"},sharp:{"fa-solid":"fass","fa-regular":"fasr","fa-light":"fasl","fa-thin":"fast"},"sharp-duotone":{"fa-solid":"fasds","fa-regular":"fasdr","fa-light":"fasdl","fa-thin":"fasdt"}},Ca={classic:["fas","far","fal","fat","fad"],duotone:["fadr","fadl","fadt"],sharp:["fass","fasr","fasl","fast"],"sharp-duotone":["fasds","fasdr","fasdl","fasdt"]},mt={classic:{fab:"fa-brands",fad:"fa-duotone",fal:"fa-light",far:"fa-regular",fas:"fa-solid",fat:"fa-thin"},duotone:{fadr:"fa-regular",fadl:"fa-light",fadt:"fa-thin"},sharp:{fass:"fa-solid",fasr:"fa-regular",fasl:"fa-light",fast:"fa-thin"},"sharp-duotone":{fasds:"fa-solid",fasdr:"fa-regular",fasdl:"fa-light",fasdt:"fa-thin"}},Ta=["fa-solid","fa-regular","fa-light","fa-thin","fa-duotone","fa-brands"],ht=["fa","fas","far","fal","fat","fad","fadr","fadl","fadt","fab","fass","fasr","fasl","fast","fasds","fasdr","fasdl","fasdt",...Oa,...Ta],Ma=["solid","regular","light","thin","duotone","brands"],ir=[1,2,3,4,5,6,7,8,9,10],Ia=ir.concat([11,12,13,14,15,16,17,18,19,20]),Na=[...Object.keys(Ca),...Ma,"2xs","xs","sm","lg","xl","2xl","beat","border","fade","beat-fade","bounce","flip-both","flip-horizontal","flip-vertical","flip","fw","inverse","layers-counter","layers-text","layers","li","pull-left","pull-right","pulse","rotate-180","rotate-270","rotate-90","rotate-by","shake","spin-pulse","spin-reverse","spin","stack-1x","stack-2x","stack","ul",Pe.GROUP,Pe.SWAP_OPACITY,Pe.PRIMARY,Pe.SECONDARY].concat(ir.map(e=>"".concat(e,"x"))).concat(Ia.map(e=>"w-".concat(e))),Fa={"Font Awesome 5 Free":{900:"fas",400:"far"},"Font Awesome 5 Pro":{900:"fas",400:"far",normal:"far",300:"fal"},"Font Awesome 5 Brands":{400:"fab",normal:"fab"},"Font Awesome 5 Duotone":{900:"fad"}};const V="___FONT_AWESOME___",pt=16,or="fa",sr="svg-inline--fa",ae="data-fa-i2svg",gt="data-fa-pseudo-element",Ra="data-fa-pseudo-element-pending",Mt="data-prefix",It="data-icon",pn="fontawesome-i2svg",Da="async",La=["HTML","HEAD","STYLE","SCRIPT"],cr=(()=>{try{return!0}catch{return!1}})();function Se(e){return new Proxy(e,{get(t,n){return n in t?t[n]:t[N]}})}const fr=u({},nr);fr[N]=u(u(u(u({},{"fa-duotone":"duotone"}),nr[N]),mn.kit),mn["kit-duotone"]);const za=Se(fr),vt=u({},ba);vt[N]=u(u(u(u({},{duotone:"fad"}),vt[N]),hn.kit),hn["kit-duotone"]);const gn=Se(vt),yt=u({},mt);yt[N]=u(u({},yt[N]),_a.kit);const Nt=Se(yt),bt=u({},Pa);bt[N]=u(u({},bt[N]),Sa.kit);Se(bt);const ja=ua,lr="fa-layers-text",qa=da,Ya=u({},ga);Se(Ya);const Ua=["class","data-prefix","data-icon","data-fa-transform","data-fa-mask"],tt=ma,Ha=[...xa,...Na],ye=Z.FontAwesomeConfig||{};function Wa(e){var t=A.querySelector("script["+e+"]");if(t)return t.getAttribute(e)}function $a(e){return e===""?!0:e==="false"?!1:e==="true"?!0:e}A&&typeof A.querySelector=="function"&&[["data-family-prefix","familyPrefix"],["data-css-prefix","cssPrefix"],["data-family-default","familyDefault"],["data-style-default","styleDefault"],["data-replacement-class","replacementClass"],["data-auto-replace-svg","autoReplaceSvg"],["data-auto-add-css","autoAddCss"],["data-auto-a11y","autoA11y"],["data-search-pseudo-elements","searchPseudoElements"],["data-observe-mutations","observeMutations"],["data-mutate-approach","mutateApproach"],["data-keep-original-source","keepOriginalSource"],["data-measure-performance","measurePerformance"],["data-show-missing-icons","showMissingIcons"]].forEach(t=>{let[n,r]=t;const a=$a(Wa(n));a!=null&&(ye[r]=a)});const ur={styleDefault:"solid",familyDefault:N,cssPrefix:or,replacementClass:sr,autoReplaceSvg:!0,autoAddCss:!0,autoA11y:!0,searchPseudoElements:!1,observeMutations:!0,mutateApproach:"async",keepOriginalSource:!0,measurePerformance:!1,showMissingIcons:!0};ye.familyPrefix&&(ye.cssPrefix=ye.familyPrefix);const de=u(u({},ur),ye);de.autoReplaceSvg||(de.observeMutations=!1);const g={};Object.keys(ur).forEach(e=>{Object.defineProperty(g,e,{enumerable:!0,set:function(t){de[e]=t,be.forEach(n=>n(g))},get:function(){return de[e]}})});Object.defineProperty(g,"familyPrefix",{enumerable:!0,set:function(e){de.cssPrefix=e,be.forEach(t=>t(g))},get:function(){return de.cssPrefix}});Z.FontAwesomeConfig=g;const be=[];function Ga(e){return be.push(e),()=>{be.splice(be.indexOf(e),1)}}const J=pt,Y={size:16,x:0,y:0,rotate:0,flipX:!1,flipY:!1};function Va(e){if(!e||!X)return;const t=A.createElement("style");t.setAttribute("type","text/css"),t.innerHTML=e;const n=A.head.childNodes;let r=null;for(let a=n.length-1;a>-1;a--){const i=n[a],o=(i.tagName||"").toUpperCase();["STYLE","LINK"].indexOf(o)>-1&&(r=i)}return A.head.insertBefore(t,r),e}const Ba="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";function we(){let e=12,t="";for(;e-- >0;)t+=Ba[Math.random()*62|0];return t}function me(e){const t=[];for(let n=(e||[]).length>>>0;n--;)t[n]=e[n];return t}function Ft(e){return e.classList?me(e.classList):(e.getAttribute("class")||"").split(" ").filter(t=>t)}function dr(e){return"".concat(e).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function Xa(e){return Object.keys(e||{}).reduce((t,n)=>t+"".concat(n,'="').concat(dr(e[n]),'" '),"").trim()}function ze(e){return Object.keys(e||{}).reduce((t,n)=>t+"".concat(n,": ").concat(e[n].trim(),";"),"")}function Rt(e){return e.size!==Y.size||e.x!==Y.x||e.y!==Y.y||e.rotate!==Y.rotate||e.flipX||e.flipY}function Qa(e){let{transform:t,containerWidth:n,iconWidth:r}=e;const a={transform:"translate(".concat(n/2," 256)")},i="translate(".concat(t.x*32,", ").concat(t.y*32,") "),o="scale(".concat(t.size/16*(t.flipX?-1:1),", ").concat(t.size/16*(t.flipY?-1:1),") "),s="rotate(".concat(t.rotate," 0 0)"),c={transform:"".concat(i," ").concat(o," ").concat(s)},f={transform:"translate(".concat(r/2*-1," -256)")};return{outer:a,inner:c,path:f}}function Ka(e){let{transform:t,width:n=pt,height:r=pt,startCentered:a=!1}=e,i="";return a&&tr?i+="translate(".concat(t.x/J-n/2,"em, ").concat(t.y/J-r/2,"em) "):a?i+="translate(calc(-50% + ".concat(t.x/J,"em), calc(-50% + ").concat(t.y/J,"em)) "):i+="translate(".concat(t.x/J,"em, ").concat(t.y/J,"em) "),i+="scale(".concat(t.size/J*(t.flipX?-1:1),", ").concat(t.size/J*(t.flipY?-1:1),") "),i+="rotate(".concat(t.rotate,"deg) "),i}var Ja=`:root, :host {
  --fa-font-solid: normal 900 1em/1 "Font Awesome 6 Free";
  --fa-font-regular: normal 400 1em/1 "Font Awesome 6 Free";
  --fa-font-light: normal 300 1em/1 "Font Awesome 6 Pro";
  --fa-font-thin: normal 100 1em/1 "Font Awesome 6 Pro";
  --fa-font-duotone: normal 900 1em/1 "Font Awesome 6 Duotone";
  --fa-font-duotone-regular: normal 400 1em/1 "Font Awesome 6 Duotone";
  --fa-font-duotone-light: normal 300 1em/1 "Font Awesome 6 Duotone";
  --fa-font-duotone-thin: normal 100 1em/1 "Font Awesome 6 Duotone";
  --fa-font-brands: normal 400 1em/1 "Font Awesome 6 Brands";
  --fa-font-sharp-solid: normal 900 1em/1 "Font Awesome 6 Sharp";
  --fa-font-sharp-regular: normal 400 1em/1 "Font Awesome 6 Sharp";
  --fa-font-sharp-light: normal 300 1em/1 "Font Awesome 6 Sharp";
  --fa-font-sharp-thin: normal 100 1em/1 "Font Awesome 6 Sharp";
  --fa-font-sharp-duotone-solid: normal 900 1em/1 "Font Awesome 6 Sharp Duotone";
  --fa-font-sharp-duotone-regular: normal 400 1em/1 "Font Awesome 6 Sharp Duotone";
  --fa-font-sharp-duotone-light: normal 300 1em/1 "Font Awesome 6 Sharp Duotone";
  --fa-font-sharp-duotone-thin: normal 100 1em/1 "Font Awesome 6 Sharp Duotone";
}

svg:not(:root).svg-inline--fa, svg:not(:host).svg-inline--fa {
  overflow: visible;
  box-sizing: content-box;
}

.svg-inline--fa {
  display: var(--fa-display, inline-block);
  height: 1em;
  overflow: visible;
  vertical-align: -0.125em;
}
.svg-inline--fa.fa-2xs {
  vertical-align: 0.1em;
}
.svg-inline--fa.fa-xs {
  vertical-align: 0em;
}
.svg-inline--fa.fa-sm {
  vertical-align: -0.0714285705em;
}
.svg-inline--fa.fa-lg {
  vertical-align: -0.2em;
}
.svg-inline--fa.fa-xl {
  vertical-align: -0.25em;
}
.svg-inline--fa.fa-2xl {
  vertical-align: -0.3125em;
}
.svg-inline--fa.fa-pull-left {
  margin-right: var(--fa-pull-margin, 0.3em);
  width: auto;
}
.svg-inline--fa.fa-pull-right {
  margin-left: var(--fa-pull-margin, 0.3em);
  width: auto;
}
.svg-inline--fa.fa-li {
  width: var(--fa-li-width, 2em);
  top: 0.25em;
}
.svg-inline--fa.fa-fw {
  width: var(--fa-fw-width, 1.25em);
}

.fa-layers svg.svg-inline--fa {
  bottom: 0;
  left: 0;
  margin: auto;
  position: absolute;
  right: 0;
  top: 0;
}

.fa-layers-counter, .fa-layers-text {
  display: inline-block;
  position: absolute;
  text-align: center;
}

.fa-layers {
  display: inline-block;
  height: 1em;
  position: relative;
  text-align: center;
  vertical-align: -0.125em;
  width: 1em;
}
.fa-layers svg.svg-inline--fa {
  transform-origin: center center;
}

.fa-layers-text {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  transform-origin: center center;
}

.fa-layers-counter {
  background-color: var(--fa-counter-background-color, #ff253a);
  border-radius: var(--fa-counter-border-radius, 1em);
  box-sizing: border-box;
  color: var(--fa-inverse, #fff);
  line-height: var(--fa-counter-line-height, 1);
  max-width: var(--fa-counter-max-width, 5em);
  min-width: var(--fa-counter-min-width, 1.5em);
  overflow: hidden;
  padding: var(--fa-counter-padding, 0.25em 0.5em);
  right: var(--fa-right, 0);
  text-overflow: ellipsis;
  top: var(--fa-top, 0);
  transform: scale(var(--fa-counter-scale, 0.25));
  transform-origin: top right;
}

.fa-layers-bottom-right {
  bottom: var(--fa-bottom, 0);
  right: var(--fa-right, 0);
  top: auto;
  transform: scale(var(--fa-layers-scale, 0.25));
  transform-origin: bottom right;
}

.fa-layers-bottom-left {
  bottom: var(--fa-bottom, 0);
  left: var(--fa-left, 0);
  right: auto;
  top: auto;
  transform: scale(var(--fa-layers-scale, 0.25));
  transform-origin: bottom left;
}

.fa-layers-top-right {
  top: var(--fa-top, 0);
  right: var(--fa-right, 0);
  transform: scale(var(--fa-layers-scale, 0.25));
  transform-origin: top right;
}

.fa-layers-top-left {
  left: var(--fa-left, 0);
  right: auto;
  top: var(--fa-top, 0);
  transform: scale(var(--fa-layers-scale, 0.25));
  transform-origin: top left;
}

.fa-1x {
  font-size: 1em;
}

.fa-2x {
  font-size: 2em;
}

.fa-3x {
  font-size: 3em;
}

.fa-4x {
  font-size: 4em;
}

.fa-5x {
  font-size: 5em;
}

.fa-6x {
  font-size: 6em;
}

.fa-7x {
  font-size: 7em;
}

.fa-8x {
  font-size: 8em;
}

.fa-9x {
  font-size: 9em;
}

.fa-10x {
  font-size: 10em;
}

.fa-2xs {
  font-size: 0.625em;
  line-height: 0.1em;
  vertical-align: 0.225em;
}

.fa-xs {
  font-size: 0.75em;
  line-height: 0.0833333337em;
  vertical-align: 0.125em;
}

.fa-sm {
  font-size: 0.875em;
  line-height: 0.0714285718em;
  vertical-align: 0.0535714295em;
}

.fa-lg {
  font-size: 1.25em;
  line-height: 0.05em;
  vertical-align: -0.075em;
}

.fa-xl {
  font-size: 1.5em;
  line-height: 0.0416666682em;
  vertical-align: -0.125em;
}

.fa-2xl {
  font-size: 2em;
  line-height: 0.03125em;
  vertical-align: -0.1875em;
}

.fa-fw {
  text-align: center;
  width: 1.25em;
}

.fa-ul {
  list-style-type: none;
  margin-left: var(--fa-li-margin, 2.5em);
  padding-left: 0;
}
.fa-ul > li {
  position: relative;
}

.fa-li {
  left: calc(-1 * var(--fa-li-width, 2em));
  position: absolute;
  text-align: center;
  width: var(--fa-li-width, 2em);
  line-height: inherit;
}

.fa-border {
  border-color: var(--fa-border-color, #eee);
  border-radius: var(--fa-border-radius, 0.1em);
  border-style: var(--fa-border-style, solid);
  border-width: var(--fa-border-width, 0.08em);
  padding: var(--fa-border-padding, 0.2em 0.25em 0.15em);
}

.fa-pull-left {
  float: left;
  margin-right: var(--fa-pull-margin, 0.3em);
}

.fa-pull-right {
  float: right;
  margin-left: var(--fa-pull-margin, 0.3em);
}

.fa-beat {
  animation-name: fa-beat;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, ease-in-out);
}

.fa-bounce {
  animation-name: fa-bounce;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, cubic-bezier(0.28, 0.84, 0.42, 1));
}

.fa-fade {
  animation-name: fa-fade;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, cubic-bezier(0.4, 0, 0.6, 1));
}

.fa-beat-fade {
  animation-name: fa-beat-fade;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, cubic-bezier(0.4, 0, 0.6, 1));
}

.fa-flip {
  animation-name: fa-flip;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, ease-in-out);
}

.fa-shake {
  animation-name: fa-shake;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, linear);
}

.fa-spin {
  animation-name: fa-spin;
  animation-delay: var(--fa-animation-delay, 0s);
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 2s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, linear);
}

.fa-spin-reverse {
  --fa-animation-direction: reverse;
}

.fa-pulse,
.fa-spin-pulse {
  animation-name: fa-spin;
  animation-direction: var(--fa-animation-direction, normal);
  animation-duration: var(--fa-animation-duration, 1s);
  animation-iteration-count: var(--fa-animation-iteration-count, infinite);
  animation-timing-function: var(--fa-animation-timing, steps(8));
}

@media (prefers-reduced-motion: reduce) {
  .fa-beat,
.fa-bounce,
.fa-fade,
.fa-beat-fade,
.fa-flip,
.fa-pulse,
.fa-shake,
.fa-spin,
.fa-spin-pulse {
    animation-delay: -1ms;
    animation-duration: 1ms;
    animation-iteration-count: 1;
    transition-delay: 0s;
    transition-duration: 0s;
  }
}
@keyframes fa-beat {
  0%, 90% {
    transform: scale(1);
  }
  45% {
    transform: scale(var(--fa-beat-scale, 1.25));
  }
}
@keyframes fa-bounce {
  0% {
    transform: scale(1, 1) translateY(0);
  }
  10% {
    transform: scale(var(--fa-bounce-start-scale-x, 1.1), var(--fa-bounce-start-scale-y, 0.9)) translateY(0);
  }
  30% {
    transform: scale(var(--fa-bounce-jump-scale-x, 0.9), var(--fa-bounce-jump-scale-y, 1.1)) translateY(var(--fa-bounce-height, -0.5em));
  }
  50% {
    transform: scale(var(--fa-bounce-land-scale-x, 1.05), var(--fa-bounce-land-scale-y, 0.95)) translateY(0);
  }
  57% {
    transform: scale(1, 1) translateY(var(--fa-bounce-rebound, -0.125em));
  }
  64% {
    transform: scale(1, 1) translateY(0);
  }
  100% {
    transform: scale(1, 1) translateY(0);
  }
}
@keyframes fa-fade {
  50% {
    opacity: var(--fa-fade-opacity, 0.4);
  }
}
@keyframes fa-beat-fade {
  0%, 100% {
    opacity: var(--fa-beat-fade-opacity, 0.4);
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(var(--fa-beat-fade-scale, 1.125));
  }
}
@keyframes fa-flip {
  50% {
    transform: rotate3d(var(--fa-flip-x, 0), var(--fa-flip-y, 1), var(--fa-flip-z, 0), var(--fa-flip-angle, -180deg));
  }
}
@keyframes fa-shake {
  0% {
    transform: rotate(-15deg);
  }
  4% {
    transform: rotate(15deg);
  }
  8%, 24% {
    transform: rotate(-18deg);
  }
  12%, 28% {
    transform: rotate(18deg);
  }
  16% {
    transform: rotate(-22deg);
  }
  20% {
    transform: rotate(22deg);
  }
  32% {
    transform: rotate(-12deg);
  }
  36% {
    transform: rotate(12deg);
  }
  40%, 100% {
    transform: rotate(0deg);
  }
}
@keyframes fa-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
.fa-rotate-90 {
  transform: rotate(90deg);
}

.fa-rotate-180 {
  transform: rotate(180deg);
}

.fa-rotate-270 {
  transform: rotate(270deg);
}

.fa-flip-horizontal {
  transform: scale(-1, 1);
}

.fa-flip-vertical {
  transform: scale(1, -1);
}

.fa-flip-both,
.fa-flip-horizontal.fa-flip-vertical {
  transform: scale(-1, -1);
}

.fa-rotate-by {
  transform: rotate(var(--fa-rotate-angle, 0));
}

.fa-stack {
  display: inline-block;
  vertical-align: middle;
  height: 2em;
  position: relative;
  width: 2.5em;
}

.fa-stack-1x,
.fa-stack-2x {
  bottom: 0;
  left: 0;
  margin: auto;
  position: absolute;
  right: 0;
  top: 0;
  z-index: var(--fa-stack-z-index, auto);
}

.svg-inline--fa.fa-stack-1x {
  height: 1em;
  width: 1.25em;
}
.svg-inline--fa.fa-stack-2x {
  height: 2em;
  width: 2.5em;
}

.fa-inverse {
  color: var(--fa-inverse, #fff);
}

.sr-only,
.fa-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.sr-only-focusable:not(:focus),
.fa-sr-only-focusable:not(:focus) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.svg-inline--fa .fa-primary {
  fill: var(--fa-primary-color, currentColor);
  opacity: var(--fa-primary-opacity, 1);
}

.svg-inline--fa .fa-secondary {
  fill: var(--fa-secondary-color, currentColor);
  opacity: var(--fa-secondary-opacity, 0.4);
}

.svg-inline--fa.fa-swap-opacity .fa-primary {
  opacity: var(--fa-secondary-opacity, 0.4);
}

.svg-inline--fa.fa-swap-opacity .fa-secondary {
  opacity: var(--fa-primary-opacity, 1);
}

.svg-inline--fa mask .fa-primary,
.svg-inline--fa mask .fa-secondary {
  fill: black;
}`;function mr(){const e=or,t=sr,n=g.cssPrefix,r=g.replacementClass;let a=Ja;if(n!==e||r!==t){const i=new RegExp("\\.".concat(e,"\\-"),"g"),o=new RegExp("\\--".concat(e,"\\-"),"g"),s=new RegExp("\\.".concat(t),"g");a=a.replace(i,".".concat(n,"-")).replace(o,"--".concat(n,"-")).replace(s,".".concat(r))}return a}let vn=!1;function nt(){g.autoAddCss&&!vn&&(Va(mr()),vn=!0)}var Za={mixout(){return{dom:{css:mr,insertCss:nt}}},hooks(){return{beforeDOMElementCreation(){nt()},beforeI2svg(){nt()}}}};const B=Z||{};B[V]||(B[V]={});B[V].styles||(B[V].styles={});B[V].hooks||(B[V].hooks={});B[V].shims||(B[V].shims=[]);var U=B[V];const hr=[],pr=function(){A.removeEventListener("DOMContentLoaded",pr),Fe=1,hr.map(e=>e())};let Fe=!1;X&&(Fe=(A.documentElement.doScroll?/^loaded|^c/:/^loaded|^i|^c/).test(A.readyState),Fe||A.addEventListener("DOMContentLoaded",pr));function ei(e){X&&(Fe?setTimeout(e,0):hr.push(e))}function Ee(e){const{tag:t,attributes:n={},children:r=[]}=e;return typeof e=="string"?dr(e):"<".concat(t," ").concat(Xa(n),">").concat(r.map(Ee).join(""),"</").concat(t,">")}function yn(e,t,n){if(e&&e[t]&&e[t][n])return{prefix:t,iconName:n,icon:e[t][n]}}var rt=function(t,n,r,a){var i=Object.keys(t),o=i.length,s=n,c,f,d;for(r===void 0?(c=1,d=t[i[0]]):(c=0,d=r);c<o;c++)f=i[c],d=s(d,t[f],f,t);return d};function ti(e){const t=[];let n=0;const r=e.length;for(;n<r;){const a=e.charCodeAt(n++);if(a>=55296&&a<=56319&&n<r){const i=e.charCodeAt(n++);(i&64512)==56320?t.push(((a&1023)<<10)+(i&1023)+65536):(t.push(a),n--)}else t.push(a)}return t}function wt(e){const t=ti(e);return t.length===1?t[0].toString(16):null}function ni(e,t){const n=e.length;let r=e.charCodeAt(t),a;return r>=55296&&r<=56319&&n>t+1&&(a=e.charCodeAt(t+1),a>=56320&&a<=57343)?(r-55296)*1024+a-56320+65536:r}function bn(e){return Object.keys(e).reduce((t,n)=>{const r=e[n];return!!r.icon?t[r.iconName]=r.icon:t[n]=r,t},{})}function xt(e,t){let n=arguments.length>2&&arguments[2]!==void 0?arguments[2]:{};const{skipHooks:r=!1}=n,a=bn(t);typeof U.hooks.addPack=="function"&&!r?U.hooks.addPack(e,bn(t)):U.styles[e]=u(u({},U.styles[e]||{}),a),e==="fas"&&xt("fa",t)}const{styles:xe,shims:ri}=U,gr=Object.keys(Nt),ai=gr.reduce((e,t)=>(e[t]=Object.keys(Nt[t]),e),{});let Dt=null,vr={},yr={},br={},wr={},xr={};function ii(e){return~Ha.indexOf(e)}function oi(e,t){const n=t.split("-"),r=n[0],a=n.slice(1).join("-");return r===e&&a!==""&&!ii(a)?a:null}const Sr=()=>{const e=r=>rt(xe,(a,i,o)=>(a[o]=rt(i,r,{}),a),{});vr=e((r,a,i)=>(a[3]&&(r[a[3]]=i),a[2]&&a[2].filter(s=>typeof s=="number").forEach(s=>{r[s.toString(16)]=i}),r)),yr=e((r,a,i)=>(r[i]=i,a[2]&&a[2].filter(s=>typeof s=="string").forEach(s=>{r[s]=i}),r)),xr=e((r,a,i)=>{const o=a[2];return r[i]=i,o.forEach(s=>{r[s]=i}),r});const t="far"in xe||g.autoFetchSvg,n=rt(ri,(r,a)=>{const i=a[0];let o=a[1];const s=a[2];return o==="far"&&!t&&(o="fas"),typeof i=="string"&&(r.names[i]={prefix:o,iconName:s}),typeof i=="number"&&(r.unicodes[i.toString(16)]={prefix:o,iconName:s}),r},{names:{},unicodes:{}});br=n.names,wr=n.unicodes,Dt=je(g.styleDefault,{family:g.familyDefault})};Ga(e=>{Dt=je(e.styleDefault,{family:g.familyDefault})});Sr();function Lt(e,t){return(vr[e]||{})[t]}function si(e,t){return(yr[e]||{})[t]}function re(e,t){return(xr[e]||{})[t]}function Er(e){return br[e]||{prefix:null,iconName:null}}function ci(e){const t=wr[e],n=Lt("fas",e);return t||(n?{prefix:"fas",iconName:n}:null)||{prefix:null,iconName:null}}function ee(){return Dt}const _r=()=>({prefix:null,iconName:null,rest:[]});function fi(e){let t=N;const n=gr.reduce((r,a)=>(r[a]="".concat(g.cssPrefix,"-").concat(a),r),{});return ar.forEach(r=>{(e.includes(n[r])||e.some(a=>ai[r].includes(a)))&&(t=r)}),t}function je(e){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};const{family:n=N}=t,r=za[n][e];if(n===Le&&!e)return"fad";const a=gn[n][e]||gn[n][r],i=e in U.styles?e:null;return a||i||null}function li(e){let t=[],n=null;return e.forEach(r=>{const a=oi(g.cssPrefix,r);a?n=a:r&&t.push(r)}),{iconName:n,rest:t}}function wn(e){return e.sort().filter((t,n,r)=>r.indexOf(t)===n)}function qe(e){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};const{skipLookups:n=!1}=t;let r=null;const a=ht.concat(Aa),i=wn(e.filter(p=>a.includes(p))),o=wn(e.filter(p=>!ht.includes(p))),s=i.filter(p=>(r=p,!rr.includes(p))),[c=null]=s,f=fi(i),d=u(u({},li(o)),{},{prefix:je(c,{family:f})});return u(u(u({},d),hi({values:e,family:f,styles:xe,config:g,canonical:d,givenPrefix:r})),ui(n,r,d))}function ui(e,t,n){let{prefix:r,iconName:a}=n;if(e||!r||!a)return{prefix:r,iconName:a};const i=t==="fa"?Er(a):{},o=re(r,a);return a=i.iconName||o||a,r=i.prefix||r,r==="far"&&!xe.far&&xe.fas&&!g.autoFetchSvg&&(r="fas"),{prefix:r,iconName:a}}const di=ar.filter(e=>e!==N||e!==Le),mi=Object.keys(mt).filter(e=>e!==N).map(e=>Object.keys(mt[e])).flat();function hi(e){const{values:t,family:n,canonical:r,givenPrefix:a="",styles:i={},config:o={}}=e,s=n===Le,c=t.includes("fa-duotone")||t.includes("fad"),f=o.familyDefault==="duotone",d=r.prefix==="fad"||r.prefix==="fa-duotone";if(!s&&(c||f||d)&&(r.prefix="fad"),(t.includes("fa-brands")||t.includes("fab"))&&(r.prefix="fab"),!r.prefix&&di.includes(n)&&(Object.keys(i).find(l=>mi.includes(l))||o.autoFetchSvg)){const l=ya.get(n).defaultShortPrefixId;r.prefix=l,r.iconName=re(r.prefix,r.iconName)||r.iconName}return(r.prefix==="fa"||a==="fa")&&(r.prefix=ee()||"fas"),r}class pi{constructor(){this.definitions={}}add(){for(var t=arguments.length,n=new Array(t),r=0;r<t;r++)n[r]=arguments[r];const a=n.reduce(this._pullDefinitions,{});Object.keys(a).forEach(i=>{this.definitions[i]=u(u({},this.definitions[i]||{}),a[i]),xt(i,a[i]);const o=Nt[N][i];o&&xt(o,a[i]),Sr()})}reset(){this.definitions={}}_pullDefinitions(t,n){const r=n.prefix&&n.iconName&&n.icon?{0:n}:n;return Object.keys(r).map(a=>{const{prefix:i,iconName:o,icon:s}=r[a],c=s[2];t[i]||(t[i]={}),c.length>0&&c.forEach(f=>{typeof f=="string"&&(t[i][f]=s)}),t[i][o]=s}),t}}let xn=[],fe={};const le={},gi=Object.keys(le);function vi(e,t){let{mixoutsTo:n}=t;return xn=e,fe={},Object.keys(le).forEach(r=>{gi.indexOf(r)===-1&&delete le[r]}),xn.forEach(r=>{const a=r.mixout?r.mixout():{};if(Object.keys(a).forEach(i=>{typeof a[i]=="function"&&(n[i]=a[i]),typeof a[i]=="object"&&Object.keys(a[i]).forEach(o=>{n[i]||(n[i]={}),n[i][o]=a[i][o]})}),r.hooks){const i=r.hooks();Object.keys(i).forEach(o=>{fe[o]||(fe[o]=[]),fe[o].push(i[o])})}r.provides&&r.provides(le)}),n}function St(e,t){for(var n=arguments.length,r=new Array(n>2?n-2:0),a=2;a<n;a++)r[a-2]=arguments[a];return(fe[e]||[]).forEach(o=>{t=o.apply(null,[t,...r])}),t}function ie(e){for(var t=arguments.length,n=new Array(t>1?t-1:0),r=1;r<t;r++)n[r-1]=arguments[r];(fe[e]||[]).forEach(i=>{i.apply(null,n)})}function te(){const e=arguments[0],t=Array.prototype.slice.call(arguments,1);return le[e]?le[e].apply(null,t):void 0}function Et(e){e.prefix==="fa"&&(e.prefix="fas");let{iconName:t}=e;const n=e.prefix||ee();if(t)return t=re(n,t)||t,yn(Or.definitions,n,t)||yn(U.styles,n,t)}const Or=new pi,yi=()=>{g.autoReplaceSvg=!1,g.observeMutations=!1,ie("noAuto")},bi={i2svg:function(){let e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};return X?(ie("beforeI2svg",e),te("pseudoElements2svg",e),te("i2svg",e)):Promise.reject(new Error("Operation requires a DOM of some kind."))},watch:function(){let e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};const{autoReplaceSvgRoot:t}=e;g.autoReplaceSvg===!1&&(g.autoReplaceSvg=!0),g.observeMutations=!0,ei(()=>{xi({autoReplaceSvgRoot:t}),ie("watch",e)})}},wi={icon:e=>{if(e===null)return null;if(typeof e=="object"&&e.prefix&&e.iconName)return{prefix:e.prefix,iconName:re(e.prefix,e.iconName)||e.iconName};if(Array.isArray(e)&&e.length===2){const t=e[1].indexOf("fa-")===0?e[1].slice(3):e[1],n=je(e[0]);return{prefix:n,iconName:re(n,t)||t}}if(typeof e=="string"&&(e.indexOf("".concat(g.cssPrefix,"-"))>-1||e.match(ja))){const t=qe(e.split(" "),{skipLookups:!0});return{prefix:t.prefix||ee(),iconName:re(t.prefix,t.iconName)||t.iconName}}if(typeof e=="string"){const t=ee();return{prefix:t,iconName:re(t,e)||e}}}},L={noAuto:yi,config:g,dom:bi,parse:wi,library:Or,findIconDefinition:Et,toHtml:Ee},xi=function(){let e=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};const{autoReplaceSvgRoot:t=A}=e;(Object.keys(U.styles).length>0||g.autoFetchSvg)&&X&&g.autoReplaceSvg&&L.dom.i2svg({node:t})};function Ye(e,t){return Object.defineProperty(e,"abstract",{get:t}),Object.defineProperty(e,"html",{get:function(){return e.abstract.map(n=>Ee(n))}}),Object.defineProperty(e,"node",{get:function(){if(!X)return;const n=A.createElement("div");return n.innerHTML=e.html,n.children}}),e}function Si(e){let{children:t,main:n,mask:r,attributes:a,styles:i,transform:o}=e;if(Rt(o)&&n.found&&!r.found){const{width:s,height:c}=n,f={x:s/c/2,y:.5};a.style=ze(u(u({},i),{},{"transform-origin":"".concat(f.x+o.x/16,"em ").concat(f.y+o.y/16,"em")}))}return[{tag:"svg",attributes:a,children:t}]}function Ei(e){let{prefix:t,iconName:n,children:r,attributes:a,symbol:i}=e;const o=i===!0?"".concat(t,"-").concat(g.cssPrefix,"-").concat(n):i;return[{tag:"svg",attributes:{style:"display: none;"},children:[{tag:"symbol",attributes:u(u({},a),{},{id:o}),children:r}]}]}function zt(e){const{icons:{main:t,mask:n},prefix:r,iconName:a,transform:i,symbol:o,title:s,maskId:c,titleId:f,extra:d,watchable:p=!1}=e,{width:l,height:v}=n.found?n:t,m=Ea.includes(r),y=[g.replacementClass,a?"".concat(g.cssPrefix,"-").concat(a):""].filter(b=>d.classes.indexOf(b)===-1).filter(b=>b!==""||!!b).concat(d.classes).join(" ");let E={children:[],attributes:u(u({},d.attributes),{},{"data-prefix":r,"data-icon":a,class:y,role:d.attributes.role||"img",xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 ".concat(l," ").concat(v)})};const S=m&&!~d.classes.indexOf("fa-fw")?{width:"".concat(l/v*16*.0625,"em")}:{};p&&(E.attributes[ae]=""),s&&(E.children.push({tag:"title",attributes:{id:E.attributes["aria-labelledby"]||"title-".concat(f||we())},children:[s]}),delete E.attributes.title);const _=u(u({},E),{},{prefix:r,iconName:a,main:t,mask:n,maskId:c,transform:i,symbol:o,styles:u(u({},S),d.styles)}),{children:P,attributes:I}=n.found&&t.found?te("generateAbstractMask",_)||{children:[],attributes:{}}:te("generateAbstractIcon",_)||{children:[],attributes:{}};return _.children=P,_.attributes=I,o?Ei(_):Si(_)}function Sn(e){const{content:t,width:n,height:r,transform:a,title:i,extra:o,watchable:s=!1}=e,c=u(u(u({},o.attributes),i?{title:i}:{}),{},{class:o.classes.join(" ")});s&&(c[ae]="");const f=u({},o.styles);Rt(a)&&(f.transform=Ka({transform:a,startCentered:!0,width:n,height:r}),f["-webkit-transform"]=f.transform);const d=ze(f);d.length>0&&(c.style=d);const p=[];return p.push({tag:"span",attributes:c,children:[t]}),i&&p.push({tag:"span",attributes:{class:"sr-only"},children:[i]}),p}function _i(e){const{content:t,title:n,extra:r}=e,a=u(u(u({},r.attributes),n?{title:n}:{}),{},{class:r.classes.join(" ")}),i=ze(r.styles);i.length>0&&(a.style=i);const o=[];return o.push({tag:"span",attributes:a,children:[t]}),n&&o.push({tag:"span",attributes:{class:"sr-only"},children:[n]}),o}const{styles:at}=U;function _t(e){const t=e[0],n=e[1],[r]=e.slice(4);let a=null;return Array.isArray(r)?a={tag:"g",attributes:{class:"".concat(g.cssPrefix,"-").concat(tt.GROUP)},children:[{tag:"path",attributes:{class:"".concat(g.cssPrefix,"-").concat(tt.SECONDARY),fill:"currentColor",d:r[0]}},{tag:"path",attributes:{class:"".concat(g.cssPrefix,"-").concat(tt.PRIMARY),fill:"currentColor",d:r[1]}}]}:a={tag:"path",attributes:{fill:"currentColor",d:r}},{found:!0,width:t,height:n,icon:a}}const Oi={found:!1,width:512,height:512};function Ai(e,t){!cr&&!g.showMissingIcons&&e&&console.error('Icon with name "'.concat(e,'" and prefix "').concat(t,'" is missing.'))}function Ot(e,t){let n=t;return t==="fa"&&g.styleDefault!==null&&(t=ee()),new Promise((r,a)=>{if(n==="fa"){const i=Er(e)||{};e=i.iconName||e,t=i.prefix||t}if(e&&t&&at[t]&&at[t][e]){const i=at[t][e];return r(_t(i))}Ai(e,t),r(u(u({},Oi),{},{icon:g.showMissingIcons&&e?te("missingIconAbstract")||{}:{}}))})}const En=()=>{},At=g.measurePerformance&&ke&&ke.mark&&ke.measure?ke:{mark:En,measure:En},ge='FA "6.7.2"',ki=e=>(At.mark("".concat(ge," ").concat(e," begins")),()=>Ar(e)),Ar=e=>{At.mark("".concat(ge," ").concat(e," ends")),At.measure("".concat(ge," ").concat(e),"".concat(ge," ").concat(e," begins"),"".concat(ge," ").concat(e," ends"))};var jt={begin:ki,end:Ar};const Te=()=>{};function _n(e){return typeof(e.getAttribute?e.getAttribute(ae):null)=="string"}function Pi(e){const t=e.getAttribute?e.getAttribute(Mt):null,n=e.getAttribute?e.getAttribute(It):null;return t&&n}function Ci(e){return e&&e.classList&&e.classList.contains&&e.classList.contains(g.replacementClass)}function Ti(){return g.autoReplaceSvg===!0?Me.replace:Me[g.autoReplaceSvg]||Me.replace}function Mi(e){return A.createElementNS("http://www.w3.org/2000/svg",e)}function Ii(e){return A.createElement(e)}function kr(e){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};const{ceFn:n=e.tag==="svg"?Mi:Ii}=t;if(typeof e=="string")return A.createTextNode(e);const r=n(e.tag);return Object.keys(e.attributes||[]).forEach(function(i){r.setAttribute(i,e.attributes[i])}),(e.children||[]).forEach(function(i){r.appendChild(kr(i,{ceFn:n}))}),r}function Ni(e){let t=" ".concat(e.outerHTML," ");return t="".concat(t,"Font Awesome fontawesome.com "),t}const Me={replace:function(e){const t=e[0];if(t.parentNode)if(e[1].forEach(n=>{t.parentNode.insertBefore(kr(n),t)}),t.getAttribute(ae)===null&&g.keepOriginalSource){let n=A.createComment(Ni(t));t.parentNode.replaceChild(n,t)}else t.remove()},nest:function(e){const t=e[0],n=e[1];if(~Ft(t).indexOf(g.replacementClass))return Me.replace(e);const r=new RegExp("".concat(g.cssPrefix,"-.*"));if(delete n[0].attributes.id,n[0].attributes.class){const i=n[0].attributes.class.split(" ").reduce((o,s)=>(s===g.replacementClass||s.match(r)?o.toSvg.push(s):o.toNode.push(s),o),{toNode:[],toSvg:[]});n[0].attributes.class=i.toSvg.join(" "),i.toNode.length===0?t.removeAttribute("class"):t.setAttribute("class",i.toNode.join(" "))}const a=n.map(i=>Ee(i)).join(`
`);t.setAttribute(ae,""),t.innerHTML=a}};function On(e){e()}function Pr(e,t){const n=typeof t=="function"?t:Te;if(e.length===0)n();else{let r=On;g.mutateApproach===Da&&(r=Z.requestAnimationFrame||On),r(()=>{const a=Ti(),i=jt.begin("mutate");e.map(a),i(),n()})}}let qt=!1;function Cr(){qt=!0}function kt(){qt=!1}let Re=null;function An(e){if(!dn||!g.observeMutations)return;const{treeCallback:t=Te,nodeCallback:n=Te,pseudoElementsCallback:r=Te,observeMutationsRoot:a=A}=e;Re=new dn(i=>{if(qt)return;const o=ee();me(i).forEach(s=>{if(s.type==="childList"&&s.addedNodes.length>0&&!_n(s.addedNodes[0])&&(g.searchPseudoElements&&r(s.target),t(s.target)),s.type==="attributes"&&s.target.parentNode&&g.searchPseudoElements&&r(s.target.parentNode),s.type==="attributes"&&_n(s.target)&&~Ua.indexOf(s.attributeName))if(s.attributeName==="class"&&Pi(s.target)){const{prefix:c,iconName:f}=qe(Ft(s.target));s.target.setAttribute(Mt,c||o),f&&s.target.setAttribute(It,f)}else Ci(s.target)&&n(s.target)})}),X&&Re.observe(a,{childList:!0,attributes:!0,characterData:!0,subtree:!0})}function Fi(){Re&&Re.disconnect()}function Ri(e){const t=e.getAttribute("style");let n=[];return t&&(n=t.split(";").reduce((r,a)=>{const i=a.split(":"),o=i[0],s=i.slice(1);return o&&s.length>0&&(r[o]=s.join(":").trim()),r},{})),n}function Di(e){const t=e.getAttribute("data-prefix"),n=e.getAttribute("data-icon"),r=e.innerText!==void 0?e.innerText.trim():"";let a=qe(Ft(e));return a.prefix||(a.prefix=ee()),t&&n&&(a.prefix=t,a.iconName=n),a.iconName&&a.prefix||(a.prefix&&r.length>0&&(a.iconName=si(a.prefix,e.innerText)||Lt(a.prefix,wt(e.innerText))),!a.iconName&&g.autoFetchSvg&&e.firstChild&&e.firstChild.nodeType===Node.TEXT_NODE&&(a.iconName=e.firstChild.data)),a}function Li(e){const t=me(e.attributes).reduce((a,i)=>(a.name!=="class"&&a.name!=="style"&&(a[i.name]=i.value),a),{}),n=e.getAttribute("title"),r=e.getAttribute("data-fa-title-id");return g.autoA11y&&(n?t["aria-labelledby"]="".concat(g.replacementClass,"-title-").concat(r||we()):(t["aria-hidden"]="true",t.focusable="false")),t}function zi(){return{iconName:null,title:null,titleId:null,prefix:null,transform:Y,symbol:!1,mask:{iconName:null,prefix:null,rest:[]},maskId:null,extra:{classes:[],styles:{},attributes:{}}}}function kn(e){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{styleParser:!0};const{iconName:n,prefix:r,rest:a}=Di(e),i=Li(e),o=St("parseNodeAttributes",{},e);let s=t.styleParser?Ri(e):[];return u({iconName:n,title:e.getAttribute("title"),titleId:e.getAttribute("data-fa-title-id"),prefix:r,transform:Y,mask:{iconName:null,prefix:null,rest:[]},maskId:null,symbol:!1,extra:{classes:a,styles:s,attributes:i}},o)}const{styles:ji}=U;function Tr(e){const t=g.autoReplaceSvg==="nest"?kn(e,{styleParser:!1}):kn(e);return~t.extra.classes.indexOf(lr)?te("generateLayersText",e,t):te("generateSvgReplacementMutation",e,t)}function qi(){return[...wa,...ht]}function Pn(e){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:null;if(!X)return Promise.resolve();const n=A.documentElement.classList,r=d=>n.add("".concat(pn,"-").concat(d)),a=d=>n.remove("".concat(pn,"-").concat(d)),i=g.autoFetchSvg?qi():rr.concat(Object.keys(ji));i.includes("fa")||i.push("fa");const o=[".".concat(lr,":not([").concat(ae,"])")].concat(i.map(d=>".".concat(d,":not([").concat(ae,"])"))).join(", ");if(o.length===0)return Promise.resolve();let s=[];try{s=me(e.querySelectorAll(o))}catch{}if(s.length>0)r("pending"),a("complete");else return Promise.resolve();const c=jt.begin("onTree"),f=s.reduce((d,p)=>{try{const l=Tr(p);l&&d.push(l)}catch(l){cr||l.name==="MissingIcon"&&console.error(l)}return d},[]);return new Promise((d,p)=>{Promise.all(f).then(l=>{Pr(l,()=>{r("active"),r("complete"),a("pending"),typeof t=="function"&&t(),c(),d()})}).catch(l=>{c(),p(l)})})}function Yi(e){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:null;Tr(e).then(n=>{n&&Pr([n],t)})}function Ui(e){return function(t){let n=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};const r=(t||{}).icon?t:Et(t||{});let{mask:a}=n;return a&&(a=(a||{}).icon?a:Et(a||{})),e(r,u(u({},n),{},{mask:a}))}}const Hi=function(e){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};const{transform:n=Y,symbol:r=!1,mask:a=null,maskId:i=null,title:o=null,titleId:s=null,classes:c=[],attributes:f={},styles:d={}}=t;if(!e)return;const{prefix:p,iconName:l,icon:v}=e;return Ye(u({type:"icon"},e),()=>(ie("beforeDOMElementCreation",{iconDefinition:e,params:t}),g.autoA11y&&(o?f["aria-labelledby"]="".concat(g.replacementClass,"-title-").concat(s||we()):(f["aria-hidden"]="true",f.focusable="false")),zt({icons:{main:_t(v),mask:a?_t(a.icon):{found:!1,width:null,height:null,icon:{}}},prefix:p,iconName:l,transform:u(u({},Y),n),symbol:r,title:o,maskId:i,titleId:s,extra:{attributes:f,styles:d,classes:c}})))};var Wi={mixout(){return{icon:Ui(Hi)}},hooks(){return{mutationObserverCallbacks(e){return e.treeCallback=Pn,e.nodeCallback=Yi,e}}},provides(e){e.i2svg=function(t){const{node:n=A,callback:r=()=>{}}=t;return Pn(n,r)},e.generateSvgReplacementMutation=function(t,n){const{iconName:r,title:a,titleId:i,prefix:o,transform:s,symbol:c,mask:f,maskId:d,extra:p}=n;return new Promise((l,v)=>{Promise.all([Ot(r,o),f.iconName?Ot(f.iconName,f.prefix):Promise.resolve({found:!1,width:512,height:512,icon:{}})]).then(m=>{let[y,E]=m;l([t,zt({icons:{main:y,mask:E},prefix:o,iconName:r,transform:s,symbol:c,maskId:d,title:a,titleId:i,extra:p,watchable:!0})])}).catch(v)})},e.generateAbstractIcon=function(t){let{children:n,attributes:r,main:a,transform:i,styles:o}=t;const s=ze(o);s.length>0&&(r.style=s);let c;return Rt(i)&&(c=te("generateAbstractTransformGrouping",{main:a,transform:i,containerWidth:a.width,iconWidth:a.width})),n.push(c||a.icon),{children:n,attributes:r}}}},$i={mixout(){return{layer(e){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};const{classes:n=[]}=t;return Ye({type:"layer"},()=>{ie("beforeDOMElementCreation",{assembler:e,params:t});let r=[];return e(a=>{Array.isArray(a)?a.map(i=>{r=r.concat(i.abstract)}):r=r.concat(a.abstract)}),[{tag:"span",attributes:{class:["".concat(g.cssPrefix,"-layers"),...n].join(" ")},children:r}]})}}}},Gi={mixout(){return{counter(e){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};const{title:n=null,classes:r=[],attributes:a={},styles:i={}}=t;return Ye({type:"counter",content:e},()=>(ie("beforeDOMElementCreation",{content:e,params:t}),_i({content:e.toString(),title:n,extra:{attributes:a,styles:i,classes:["".concat(g.cssPrefix,"-layers-counter"),...r]}})))}}}},Vi={mixout(){return{text(e){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};const{transform:n=Y,title:r=null,classes:a=[],attributes:i={},styles:o={}}=t;return Ye({type:"text",content:e},()=>(ie("beforeDOMElementCreation",{content:e,params:t}),Sn({content:e,transform:u(u({},Y),n),title:r,extra:{attributes:i,styles:o,classes:["".concat(g.cssPrefix,"-layers-text"),...a]}})))}}},provides(e){e.generateLayersText=function(t,n){const{title:r,transform:a,extra:i}=n;let o=null,s=null;if(tr){const c=parseInt(getComputedStyle(t).fontSize,10),f=t.getBoundingClientRect();o=f.width/c,s=f.height/c}return g.autoA11y&&!r&&(i.attributes["aria-hidden"]="true"),Promise.resolve([t,Sn({content:t.innerHTML,width:o,height:s,transform:a,title:r,extra:i,watchable:!0})])}}};const Bi=new RegExp('"',"ug"),Cn=[1105920,1112319],Tn=u(u(u(u({},{FontAwesome:{normal:"fas",400:"fas"}}),va),Fa),ka),Pt=Object.keys(Tn).reduce((e,t)=>(e[t.toLowerCase()]=Tn[t],e),{}),Xi=Object.keys(Pt).reduce((e,t)=>{const n=Pt[t];return e[t]=n[900]||[...Object.entries(n)][0][1],e},{});function Qi(e){const t=e.replace(Bi,""),n=ni(t,0),r=n>=Cn[0]&&n<=Cn[1],a=t.length===2?t[0]===t[1]:!1;return{value:wt(a?t[0]:t),isSecondary:r||a}}function Ki(e,t){const n=e.replace(/^['"]|['"]$/g,"").toLowerCase(),r=parseInt(t),a=isNaN(r)?"normal":r;return(Pt[n]||{})[a]||Xi[n]}function Mn(e,t){const n="".concat(Ra).concat(t.replace(":","-"));return new Promise((r,a)=>{if(e.getAttribute(n)!==null)return r();const o=me(e.children).filter(l=>l.getAttribute(gt)===t)[0],s=Z.getComputedStyle(e,t),c=s.getPropertyValue("font-family"),f=c.match(qa),d=s.getPropertyValue("font-weight"),p=s.getPropertyValue("content");if(o&&!f)return e.removeChild(o),r();if(f&&p!=="none"&&p!==""){const l=s.getPropertyValue("content");let v=Ki(c,d);const{value:m,isSecondary:y}=Qi(l),E=f[0].startsWith("FontAwesome");let S=Lt(v,m),_=S;if(E){const P=ci(m);P.iconName&&P.prefix&&(S=P.iconName,v=P.prefix)}if(S&&!y&&(!o||o.getAttribute(Mt)!==v||o.getAttribute(It)!==_)){e.setAttribute(n,_),o&&e.removeChild(o);const P=zi(),{extra:I}=P;I.attributes[gt]=t,Ot(S,v).then(b=>{const O=zt(u(u({},P),{},{icons:{main:b,mask:_r()},prefix:v,iconName:_,extra:I,watchable:!0})),T=A.createElementNS("http://www.w3.org/2000/svg","svg");t==="::before"?e.insertBefore(T,e.firstChild):e.appendChild(T),T.outerHTML=O.map(R=>Ee(R)).join(`
`),e.removeAttribute(n),r()}).catch(a)}else r()}else r()})}function Ji(e){return Promise.all([Mn(e,"::before"),Mn(e,"::after")])}function Zi(e){return e.parentNode!==document.head&&!~La.indexOf(e.tagName.toUpperCase())&&!e.getAttribute(gt)&&(!e.parentNode||e.parentNode.tagName!=="svg")}function In(e){if(X)return new Promise((t,n)=>{const r=me(e.querySelectorAll("*")).filter(Zi).map(Ji),a=jt.begin("searchPseudoElements");Cr(),Promise.all(r).then(()=>{a(),kt(),t()}).catch(()=>{a(),kt(),n()})})}var eo={hooks(){return{mutationObserverCallbacks(e){return e.pseudoElementsCallback=In,e}}},provides(e){e.pseudoElements2svg=function(t){const{node:n=A}=t;g.searchPseudoElements&&In(n)}}};let Nn=!1;var to={mixout(){return{dom:{unwatch(){Cr(),Nn=!0}}}},hooks(){return{bootstrap(){An(St("mutationObserverCallbacks",{}))},noAuto(){Fi()},watch(e){const{observeMutationsRoot:t}=e;Nn?kt():An(St("mutationObserverCallbacks",{observeMutationsRoot:t}))}}}};const Fn=e=>{let t={size:16,x:0,y:0,flipX:!1,flipY:!1,rotate:0};return e.toLowerCase().split(" ").reduce((n,r)=>{const a=r.toLowerCase().split("-"),i=a[0];let o=a.slice(1).join("-");if(i&&o==="h")return n.flipX=!0,n;if(i&&o==="v")return n.flipY=!0,n;if(o=parseFloat(o),isNaN(o))return n;switch(i){case"grow":n.size=n.size+o;break;case"shrink":n.size=n.size-o;break;case"left":n.x=n.x-o;break;case"right":n.x=n.x+o;break;case"up":n.y=n.y-o;break;case"down":n.y=n.y+o;break;case"rotate":n.rotate=n.rotate+o;break}return n},t)};var no={mixout(){return{parse:{transform:e=>Fn(e)}}},hooks(){return{parseNodeAttributes(e,t){const n=t.getAttribute("data-fa-transform");return n&&(e.transform=Fn(n)),e}}},provides(e){e.generateAbstractTransformGrouping=function(t){let{main:n,transform:r,containerWidth:a,iconWidth:i}=t;const o={transform:"translate(".concat(a/2," 256)")},s="translate(".concat(r.x*32,", ").concat(r.y*32,") "),c="scale(".concat(r.size/16*(r.flipX?-1:1),", ").concat(r.size/16*(r.flipY?-1:1),") "),f="rotate(".concat(r.rotate," 0 0)"),d={transform:"".concat(s," ").concat(c," ").concat(f)},p={transform:"translate(".concat(i/2*-1," -256)")},l={outer:o,inner:d,path:p};return{tag:"g",attributes:u({},l.outer),children:[{tag:"g",attributes:u({},l.inner),children:[{tag:n.icon.tag,children:n.icon.children,attributes:u(u({},n.icon.attributes),l.path)}]}]}}}};const it={x:0,y:0,width:"100%",height:"100%"};function Rn(e){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:!0;return e.attributes&&(e.attributes.fill||t)&&(e.attributes.fill="black"),e}function ro(e){return e.tag==="g"?e.children:[e]}var ao={hooks(){return{parseNodeAttributes(e,t){const n=t.getAttribute("data-fa-mask"),r=n?qe(n.split(" ").map(a=>a.trim())):_r();return r.prefix||(r.prefix=ee()),e.mask=r,e.maskId=t.getAttribute("data-fa-mask-id"),e}}},provides(e){e.generateAbstractMask=function(t){let{children:n,attributes:r,main:a,mask:i,maskId:o,transform:s}=t;const{width:c,icon:f}=a,{width:d,icon:p}=i,l=Qa({transform:s,containerWidth:d,iconWidth:c}),v={tag:"rect",attributes:u(u({},it),{},{fill:"white"})},m=f.children?{children:f.children.map(Rn)}:{},y={tag:"g",attributes:u({},l.inner),children:[Rn(u({tag:f.tag,attributes:u(u({},f.attributes),l.path)},m))]},E={tag:"g",attributes:u({},l.outer),children:[y]},S="mask-".concat(o||we()),_="clip-".concat(o||we()),P={tag:"mask",attributes:u(u({},it),{},{id:S,maskUnits:"userSpaceOnUse",maskContentUnits:"userSpaceOnUse"}),children:[v,E]},I={tag:"defs",children:[{tag:"clipPath",attributes:{id:_},children:ro(p)},P]};return n.push(I,{tag:"rect",attributes:u({fill:"currentColor","clip-path":"url(#".concat(_,")"),mask:"url(#".concat(S,")")},it)}),{children:n,attributes:r}}}},io={provides(e){let t=!1;Z.matchMedia&&(t=Z.matchMedia("(prefers-reduced-motion: reduce)").matches),e.missingIconAbstract=function(){const n=[],r={fill:"currentColor"},a={attributeType:"XML",repeatCount:"indefinite",dur:"2s"};n.push({tag:"path",attributes:u(u({},r),{},{d:"M156.5,447.7l-12.6,29.5c-18.7-9.5-35.9-21.2-51.5-34.9l22.7-22.7C127.6,430.5,141.5,440,156.5,447.7z M40.6,272H8.5 c1.4,21.2,5.4,41.7,11.7,61.1L50,321.2C45.1,305.5,41.8,289,40.6,272z M40.6,240c1.4-18.8,5.2-37,11.1-54.1l-29.5-12.6 C14.7,194.3,10,216.7,8.5,240H40.6z M64.3,156.5c7.8-14.9,17.2-28.8,28.1-41.5L69.7,92.3c-13.7,15.6-25.5,32.8-34.9,51.5 L64.3,156.5z M397,419.6c-13.9,12-29.4,22.3-46.1,30.4l11.9,29.8c20.7-9.9,39.8-22.6,56.9-37.6L397,419.6z M115,92.4 c13.9-12,29.4-22.3,46.1-30.4l-11.9-29.8c-20.7,9.9-39.8,22.6-56.8,37.6L115,92.4z M447.7,355.5c-7.8,14.9-17.2,28.8-28.1,41.5 l22.7,22.7c13.7-15.6,25.5-32.9,34.9-51.5L447.7,355.5z M471.4,272c-1.4,18.8-5.2,37-11.1,54.1l29.5,12.6 c7.5-21.1,12.2-43.5,13.6-66.8H471.4z M321.2,462c-15.7,5-32.2,8.2-49.2,9.4v32.1c21.2-1.4,41.7-5.4,61.1-11.7L321.2,462z M240,471.4c-18.8-1.4-37-5.2-54.1-11.1l-12.6,29.5c21.1,7.5,43.5,12.2,66.8,13.6V471.4z M462,190.8c5,15.7,8.2,32.2,9.4,49.2h32.1 c-1.4-21.2-5.4-41.7-11.7-61.1L462,190.8z M92.4,397c-12-13.9-22.3-29.4-30.4-46.1l-29.8,11.9c9.9,20.7,22.6,39.8,37.6,56.9 L92.4,397z M272,40.6c18.8,1.4,36.9,5.2,54.1,11.1l12.6-29.5C317.7,14.7,295.3,10,272,8.5V40.6z M190.8,50 c15.7-5,32.2-8.2,49.2-9.4V8.5c-21.2,1.4-41.7,5.4-61.1,11.7L190.8,50z M442.3,92.3L419.6,115c12,13.9,22.3,29.4,30.5,46.1 l29.8-11.9C470,128.5,457.3,109.4,442.3,92.3z M397,92.4l22.7-22.7c-15.6-13.7-32.8-25.5-51.5-34.9l-12.6,29.5 C370.4,72.1,384.4,81.5,397,92.4z"})});const i=u(u({},a),{},{attributeName:"opacity"}),o={tag:"circle",attributes:u(u({},r),{},{cx:"256",cy:"364",r:"28"}),children:[]};return t||o.children.push({tag:"animate",attributes:u(u({},a),{},{attributeName:"r",values:"28;14;28;28;14;28;"})},{tag:"animate",attributes:u(u({},i),{},{values:"1;0;1;1;0;1;"})}),n.push(o),n.push({tag:"path",attributes:u(u({},r),{},{opacity:"1",d:"M263.7,312h-16c-6.6,0-12-5.4-12-12c0-71,77.4-63.9,77.4-107.8c0-20-17.8-40.2-57.4-40.2c-29.1,0-44.3,9.6-59.2,28.7 c-3.9,5-11.1,6-16.2,2.4l-13.1-9.2c-5.6-3.9-6.9-11.8-2.6-17.2c21.2-27.2,46.4-44.7,91.2-44.7c52.3,0,97.4,29.8,97.4,80.2 c0,67.6-77.4,63.5-77.4,107.8C275.7,306.6,270.3,312,263.7,312z"}),children:t?[]:[{tag:"animate",attributes:u(u({},i),{},{values:"1;0;0;0;0;1;"})}]}),t||n.push({tag:"path",attributes:u(u({},r),{},{opacity:"0",d:"M232.5,134.5l7,168c0.3,6.4,5.6,11.5,12,11.5h9c6.4,0,11.7-5.1,12-11.5l7-168c0.3-6.8-5.2-12.5-12-12.5h-23 C237.7,122,232.2,127.7,232.5,134.5z"}),children:[{tag:"animate",attributes:u(u({},i),{},{values:"0;0;1;1;0;0;"})}]}),{tag:"g",attributes:{class:"missing"},children:n}}}},oo={hooks(){return{parseNodeAttributes(e,t){const n=t.getAttribute("data-fa-symbol"),r=n===null?!1:n===""?!0:n;return e.symbol=r,e}}}},so=[Za,Wi,$i,Gi,Vi,eo,to,no,ao,io,oo];vi(so,{mixoutsTo:L});L.noAuto;L.config;L.library;L.dom;const qo=L.parse;L.findIconDefinition;L.toHtml;const Yo=L.icon;L.layer;L.text;L.counter;var ot={exports:{}},st,Dn;function co(){if(Dn)return st;Dn=1;var e="SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED";return st=e,st}var ct,Ln;function fo(){if(Ln)return ct;Ln=1;var e=co();function t(){}function n(){}return n.resetWarningCache=t,ct=function(){function r(o,s,c,f,d,p){if(p!==e){var l=new Error("Calling PropTypes validators directly is not supported by the `prop-types` package. Use PropTypes.checkPropTypes() to call them. Read more at http://fb.me/use-check-prop-types");throw l.name="Invariant Violation",l}}r.isRequired=r;function a(){return r}var i={array:r,bigint:r,bool:r,func:r,number:r,object:r,string:r,symbol:r,any:r,arrayOf:a,element:r,elementType:r,instanceOf:a,node:r,objectOf:a,oneOf:a,oneOfType:a,shape:a,exact:a,checkPropTypes:n,resetWarningCache:t};return i.PropTypes=i,i},ct}var zn;function lo(){return zn||(zn=1,ot.exports=fo()()),ot.exports}var uo=lo();const Uo=Wn(uo);/*!
 * Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com
 * License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License)
 * Copyright 2024 Fonticons, Inc.
 */const mo={prefix:"fas",iconName:"calendar-days",icon:[448,512,["calendar-alt"],"f073","M128 0c17.7 0 32 14.3 32 32l0 32 128 0 0-32c0-17.7 14.3-32 32-32s32 14.3 32 32l0 32 48 0c26.5 0 48 21.5 48 48l0 48L0 160l0-48C0 85.5 21.5 64 48 64l48 0 0-32c0-17.7 14.3-32 32-32zM0 192l448 0 0 272c0 26.5-21.5 48-48 48L48 512c-26.5 0-48-21.5-48-48L0 192zm64 80l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zm128 0l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0zM64 400l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16zm144-16c-8.8 0-16 7.2-16 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0zm112 16l0 32c0 8.8 7.2 16 16 16l32 0c8.8 0 16-7.2 16-16l0-32c0-8.8-7.2-16-16-16l-32 0c-8.8 0-16 7.2-16 16z"]},Ho=mo,Wo={prefix:"fas",iconName:"fingerprint",icon:[512,512,[],"f577","M48 256C48 141.1 141.1 48 256 48c63.1 0 119.6 28.1 157.8 72.5c8.6 10.1 23.8 11.2 33.8 2.6s11.2-23.8 2.6-33.8C403.3 34.6 333.7 0 256 0C114.6 0 0 114.6 0 256l0 40c0 13.3 10.7 24 24 24s24-10.7 24-24l0-40zm458.5-52.9c-2.7-13-15.5-21.3-28.4-18.5s-21.3 15.5-18.5 28.4c2.9 13.9 4.5 28.3 4.5 43.1l0 40c0 13.3 10.7 24 24 24s24-10.7 24-24l0-40c0-18.1-1.9-35.8-5.5-52.9zM256 80c-19 0-37.4 3-54.5 8.6c-15.2 5-18.7 23.7-8.3 35.9c7.1 8.3 18.8 10.8 29.4 7.9c10.6-2.9 21.8-4.4 33.4-4.4c70.7 0 128 57.3 128 128l0 24.9c0 25.2-1.5 50.3-4.4 75.3c-1.7 14.6 9.4 27.8 24.2 27.8c11.8 0 21.9-8.6 23.3-20.3c3.3-27.4 5-55 5-82.7l0-24.9c0-97.2-78.8-176-176-176zM150.7 148.7c-9.1-10.6-25.3-11.4-33.9-.4C93.7 178 80 215.4 80 256l0 24.9c0 24.2-2.6 48.4-7.8 71.9C68.8 368.4 80.1 384 96.1 384c10.5 0 19.9-7 22.2-17.3c6.4-28.1 9.7-56.8 9.7-85.8l0-24.9c0-27.2 8.5-52.4 22.9-73.1c7.2-10.4 8-24.6-.2-34.2zM256 160c-53 0-96 43-96 96l0 24.9c0 35.9-4.6 71.5-13.8 106.1c-3.8 14.3 6.7 29 21.5 29c9.5 0 17.9-6.2 20.4-15.4c10.5-39 15.9-79.2 15.9-119.7l0-24.9c0-28.7 23.3-52 52-52s52 23.3 52 52l0 24.9c0 36.3-3.5 72.4-10.4 107.9c-2.7 13.9 7.7 27.2 21.8 27.2c10.2 0 19-7 21-17c7.7-38.8 11.6-78.3 11.6-118.1l0-24.9c0-53-43-96-96-96zm24 96c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 24.9c0 59.9-11 119.3-32.5 175.2l-5.9 15.3c-4.8 12.4 1.4 26.3 13.8 31s26.3-1.4 31-13.8l5.9-15.3C267.9 411.9 280 346.7 280 280.9l0-24.9z"]},$o={prefix:"fas",iconName:"seedling",icon:[512,512,[127793,"sprout"],"f4d8","M512 32c0 113.6-84.6 207.5-194.2 222c-7.1-53.4-30.6-101.6-65.3-139.3C290.8 46.3 364 0 448 0l32 0c17.7 0 32 14.3 32 32zM0 96C0 78.3 14.3 64 32 64l32 0c123.7 0 224 100.3 224 224l0 32 0 160c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-160C100.3 320 0 219.7 0 96z"]},Go={prefix:"fas",iconName:"trash",icon:[448,512,[],"f1f8","M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z"]},Vo={prefix:"fas",iconName:"upload",icon:[512,512,[],"f093","M288 109.3L288 352c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-242.7-73.4 73.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0l128 128c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 109.3zM64 352l128 0c0 35.3 28.7 64 64 64s64-28.7 64-64l128 0c35.3 0 64 28.7 64 64l0 32c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64l0-32c0-35.3 28.7-64 64-64zM432 456a24 24 0 1 0 0-48 24 24 0 1 0 0 48z"]},Bo={prefix:"fas",iconName:"droplet",icon:[384,512,[128167,"tint"],"f043","M192 512C86 512 0 426 0 320C0 228.8 130.2 57.7 166.6 11.7C172.6 4.2 181.5 0 191.1 0l1.8 0c9.6 0 18.5 4.2 24.5 11.7C253.8 57.7 384 228.8 384 320c0 106-86 192-192 192zM96 336c0-8.8-7.2-16-16-16s-16 7.2-16 16c0 61.9 50.1 112 112 112c8.8 0 16-7.2 16-16s-7.2-16-16-16c-44.2 0-80-35.8-80-80z"]},Xo={prefix:"fas",iconName:"arrow-up",icon:[384,512,[8593],"f062","M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 141.2 160 448c0 17.7 14.3 32 32 32s32-14.3 32-32l0-306.7L329.4 246.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160z"]},Qo={prefix:"fas",iconName:"plus",icon:[448,512,[10133,61543,"add"],"2b","M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 144L48 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l144 0 0 144c0 17.7 14.3 32 32 32s32-14.3 32-32l0-144 144 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-144 0 0-144z"]},Ko={prefix:"fas",iconName:"expand",icon:[448,512,[],"f065","M32 32C14.3 32 0 46.3 0 64l0 96c0 17.7 14.3 32 32 32s32-14.3 32-32l0-64 64 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 96c0 17.7 14.3 32 32 32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0 0-64zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32l64 0 0 64c0 17.7 14.3 32 32 32s32-14.3 32-32l0-96c0-17.7-14.3-32-32-32l-96 0zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 64-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c17.7 0 32-14.3 32-32l0-96z"]},Jo={prefix:"fas",iconName:"chevron-left",icon:[320,512,[9001],"f053","M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z"]},Zo={prefix:"fas",iconName:"chevron-right",icon:[320,512,[9002],"f054","M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"]},es={prefix:"fas",iconName:"circle-xmark",icon:[512,512,[61532,"times-circle","xmark-circle"],"f057","M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z"]};var ft,jn;function ho(){if(jn)return ft;jn=1;const e=(c,f,d,p)=>{if(d==="length"||d==="prototype"||d==="arguments"||d==="caller")return;const l=Object.getOwnPropertyDescriptor(c,d),v=Object.getOwnPropertyDescriptor(f,d);!t(l,v)&&p||Object.defineProperty(c,d,v)},t=function(c,f){return c===void 0||c.configurable||c.writable===f.writable&&c.enumerable===f.enumerable&&c.configurable===f.configurable&&(c.writable||c.value===f.value)},n=(c,f)=>{const d=Object.getPrototypeOf(f);d!==Object.getPrototypeOf(c)&&Object.setPrototypeOf(c,d)},r=(c,f)=>`/* Wrapped ${c}*/
${f}`,a=Object.getOwnPropertyDescriptor(Function.prototype,"toString"),i=Object.getOwnPropertyDescriptor(Function.prototype.toString,"name"),o=(c,f,d)=>{const p=d===""?"":`with ${d.trim()}() `,l=r.bind(null,p,f.toString());Object.defineProperty(l,"name",i),Object.defineProperty(c,"toString",{...a,value:l})};return ft=(c,f,{ignoreNonConfigurable:d=!1}={})=>{const{name:p}=c;for(const l of Reflect.ownKeys(f))e(c,f,l,d);return n(c,f),o(c,f,p),c},ft}var ve={exports:{}},lt,qn;function po(){return qn||(qn=1,lt=()=>{const e={};return e.promise=new Promise((t,n)=>{e.resolve=t,e.reject=n}),e}),lt}var Ce=ve.exports,Yn;function go(){return Yn||(Yn=1,function(e,t){var n=Ce&&Ce.__awaiter||function(o,s,c,f){return new(c||(c=Promise))(function(d,p){function l(y){try{m(f.next(y))}catch(E){p(E)}}function v(y){try{m(f.throw(y))}catch(E){p(E)}}function m(y){y.done?d(y.value):new c(function(E){E(y.value)}).then(l,v)}m((f=f.apply(o,s||[])).next())})},r=Ce&&Ce.__importDefault||function(o){return o&&o.__esModule?o:{default:o}};Object.defineProperty(t,"__esModule",{value:!0});const a=r(po());function i(o,s="maxAge"){let c,f,d;const p=()=>n(this,void 0,void 0,function*(){if(c!==void 0)return;const m=y=>n(this,void 0,void 0,function*(){d=a.default();const E=y[1][s]-Date.now();if(E<=0){o.delete(y[0]),d.resolve();return}return c=y[0],f=setTimeout(()=>{o.delete(y[0]),d&&d.resolve()},E),typeof f.unref=="function"&&f.unref(),d.promise});try{for(const y of o)yield m(y)}catch{}c=void 0}),l=()=>{c=void 0,f!==void 0&&(clearTimeout(f),f=void 0),d!==void 0&&(d.reject(void 0),d=void 0)},v=o.set.bind(o);return o.set=(m,y)=>{o.has(m)&&o.delete(m);const E=v(m,y);return c&&c===m&&l(),p(),E},p(),o}t.default=i,e.exports=i,e.exports.default=i}(ve,ve.exports)),ve.exports}var ut,Un;function vo(){if(Un)return ut;Un=1;const e=ho(),t=go(),n=new WeakMap,r=new WeakMap,a=(i,{cacheKey:o,cache:s=new Map,maxAge:c}={})=>{typeof c=="number"&&t(s);const f=function(...d){const p=o?o(d):d[0],l=s.get(p);if(l)return l.data;const v=i.apply(this,d);return s.set(p,{data:v,maxAge:c?Date.now()+c:Number.POSITIVE_INFINITY}),v};return e(f,i,{ignoreNonConfigurable:!0}),r.set(f,s),f};return a.decorator=(i={})=>(o,s,c)=>{const f=o[s];if(typeof f!="function")throw new TypeError("The decorated value must be a function");delete c.value,delete c.writable,c.get=function(){if(!n.has(this)){const d=a(f,i);return n.set(this,d),d}return n.get(this)}},a.clear=i=>{const o=r.get(i);if(!o)throw new TypeError("Can't clear a function that was not memoized!");if(typeof o.clear!="function")throw new TypeError("The cache Map can't be cleared!");o.clear()},ut=a,ut}var yo=vo();const Mr=Wn(yo);function bo(e){return typeof e=="string"}function wo(e,t,n){return n.indexOf(e)===t}function xo(e){return e.toLowerCase()===e}function Hn(e){return e.indexOf(",")===-1?e:e.split(",")}function Ct(e){if(!e)return e;if(e==="C"||e==="posix"||e==="POSIX")return"en-US";if(e.indexOf(".")!==-1){var t=e.split(".")[0],n=t===void 0?"":t;return Ct(n)}if(e.indexOf("@")!==-1){var r=e.split("@")[0],n=r===void 0?"":r;return Ct(n)}if(e.indexOf("-")===-1||!xo(e))return e;var a=e.split("-"),i=a[0],o=a[1],s=o===void 0?"":o;return"".concat(i,"-").concat(s.toUpperCase())}function So(e){var t=e===void 0?{}:e,n=t.useFallbackLocale,r=n===void 0?!0:n,a=t.fallbackLocale,i=a===void 0?"en-US":a,o=[];if(typeof navigator<"u"){for(var s=navigator.languages||[],c=[],f=0,d=s;f<d.length;f++){var p=d[f];c=c.concat(Hn(p))}var l=navigator.language,v=l&&Hn(l);o=o.concat(c,v)}return r&&o.push(i),o.filter(bo).map(Ct).filter(wo)}var Eo=Mr(So,{cacheKey:JSON.stringify});function _o(e){return Eo(e)[0]||null}var ts=Mr(_o,{cacheKey:JSON.stringify});function Q(e,t,n){return function(a,i){i===void 0&&(i=n);var o=e(a)+i;return t(o)}}function _e(e){return function(n){return new Date(e(n).getTime()-1)}}function Oe(e,t){return function(r){return[e(r),t(r)]}}function F(e){if(e instanceof Date)return e.getFullYear();if(typeof e=="number")return e;var t=parseInt(e,10);if(typeof e=="string"&&!isNaN(t))return t;throw new Error("Failed to get year from date: ".concat(e,"."))}function Ue(e){if(e instanceof Date)return e.getMonth();throw new Error("Failed to get month from date: ".concat(e,"."))}function Yt(e){if(e instanceof Date)return e.getDate();throw new Error("Failed to get year from date: ".concat(e,"."))}function Ut(e){var t=F(e),n=t+(-t+1)%100,r=new Date;return r.setFullYear(n,0,1),r.setHours(0,0,0,0),r}var ns=Q(F,Ut,-100),Oo=Q(F,Ut,100),Ir=_e(Oo),rs=Q(F,Ir,-100),as=Oe(Ut,Ir);function Ht(e){var t=F(e),n=t+(-t+1)%10,r=new Date;return r.setFullYear(n,0,1),r.setHours(0,0,0,0),r}var is=Q(F,Ht,-10),Ao=Q(F,Ht,10),Nr=_e(Ao),os=Q(F,Nr,-10),ss=Oe(Ht,Nr);function Wt(e){var t=F(e),n=new Date;return n.setFullYear(t,0,1),n.setHours(0,0,0,0),n}var cs=Q(F,Wt,-1),ko=Q(F,Wt,1),Fr=_e(ko),fs=Q(F,Fr,-1),ls=Oe(Wt,Fr);function $t(e,t){return function(r,a){a===void 0&&(a=t);var i=F(r),o=Ue(r)+a,s=new Date;return s.setFullYear(i,o,1),s.setHours(0,0,0,0),e(s)}}function Gt(e){var t=F(e),n=Ue(e),r=new Date;return r.setFullYear(t,n,1),r.setHours(0,0,0,0),r}var us=$t(Gt,-1),Po=$t(Gt,1),Vt=_e(Po),ds=$t(Vt,-1),ms=Oe(Gt,Vt);function Co(e,t){return function(r,a){a===void 0&&(a=t);var i=F(r),o=Ue(r),s=Yt(r)+a,c=new Date;return c.setFullYear(i,o,s),c.setHours(0,0,0,0),e(c)}}function Rr(e){var t=F(e),n=Ue(e),r=Yt(e),a=new Date;return a.setFullYear(t,n,r),a.setHours(0,0,0,0),a}var To=Co(Rr,1),Mo=_e(To),hs=Oe(Rr,Mo);function ps(e){return Yt(Vt(e))}export{Xo as $,Oo as A,ds as B,fs as C,os as D,rs as E,F,Ue as G,ss as H,as as I,hs as J,ms as K,ls as L,jo as M,ps as N,Yt as O,Uo as P,es as Q,Qo as R,Bo as S,Vo as T,Wo as U,$o as V,Go as W,Jo as X,Ko as Y,Zo as Z,Ho as _,Ro as a,Fo as b,Do as c,zo as d,Lo as e,Rr as f,ts as g,Gt as h,Yo as i,Wt as j,Ht as k,Ut as l,Mo as m,Vt as n,Fr as o,qo as p,Nr as q,No as r,Ir as s,us as t,cs as u,is as v,ns as w,Po as x,ko as y,Ao as z};
