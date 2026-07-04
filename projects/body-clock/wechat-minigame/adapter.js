/* 体内时钟 — 平台适配层
 *
 * 所有 wx. / tt. API 调用集中在本文件，game.js 只认这里导出的接口。
 * 微信小游戏与抖音（字节）小游戏 API 高度同构：全局对象 wx ↔ tt，
 * 方法名基本一致，差异见 DEPLOY.md 的对照表。
 * 在两个平台发布同一份代码时，本文件自动探测全局对象。
 */
'use strict';

/* eslint-disable no-undef */
var api = (typeof wx !== 'undefined') ? wx
        : (typeof tt !== 'undefined') ? tt
        : null;

var PLATFORM = (typeof tt !== 'undefined') ? 'douyin'
             : (typeof wx !== 'undefined') ? 'wechat'
             : 'unknown';

module.exports = {
  platform: PLATFORM,

  /* ---------- 画布与系统信息 ---------- */
  createCanvas: function () {
    // 微信/抖音小游戏首个 createCanvas 返回上屏画布。
    // 降级：非小游戏环境（误在 Node/浏览器加载）时快速失败并给出可读原因，
    // 避免后续在 null 画布上静默报错。
    if (api && api.createCanvas) return api.createCanvas();
    throw new Error('body-clock: 请在微信/抖音小游戏环境运行（未检测到 wx/tt）');
  },
  getSystemInfo: function () {
    try { return api.getSystemInfoSync(); }
    catch (e) { return { windowWidth: 375, windowHeight: 667, pixelRatio: 2 }; }
  },

  /* ---------- 触摸（无 api 时降级为空操作，便于骨架静态加载） ---------- */
  onTouchStart: function (fn) { if (api && api.onTouchStart) api.onTouchStart(fn); },
  onTouchEnd: function (fn) { if (api && api.onTouchEnd) api.onTouchEnd(fn); },
  onTouchCancel: function (fn) { if (api && api.onTouchCancel) api.onTouchCancel(fn); },

  /* ---------- 震动（按下/松开的轻触反馈） ----------
   * 微信: wx.vibrateShort({ type: 'light' | 'medium' | 'heavy' })
   * 抖音: tt.vibrateShort() —— 不支持 type 参数，传了会被忽略，无副作用
   */
  vibrateLight: function () {
    if (!api || !api.vibrateShort) return;
    try { api.vibrateShort({ type: 'light', fail: function () {} }); } catch (e) {}
  },

  /* ---------- 持久化（同步接口 + 容错） ---------- */
  getStorage: function (key) {
    try { return api.getStorageSync(key); } catch (e) { return null; }
  },
  setStorage: function (key, value) {
    try { api.setStorageSync(key, value); } catch (e) {}
  },

  /* ---------- 分享 ----------
   * 微信: wx.shareAppMessage({ title, imageUrl })
   *       被动分享需先 wx.showShareMenu({ withShareTicket: false })
   * 抖音: tt.shareAppMessage({ title, imageUrl, success, fail })
   *       另有 channel: 'video' 可拉起录屏发布（抖音特色，见 DEPLOY.md）
   * imageUrl 建议 5:4，可用离屏 canvas 的 toTempFilePathSync 生成当日战报图
   */
  showShareMenu: function () {
    if (api && api.showShareMenu) { try { api.showShareMenu({}); } catch (e) {} }
  },
  shareAppMessage: function (opts) {
    if (api && api.shareAppMessage) {
      try { api.shareAppMessage({ title: opts.title, imageUrl: opts.imageUrl }); } catch (e) {}
    }
  },
  onShareAppMessage: function (fn) {
    // 右上角"..."被动分享的内容也走同一份文案
    if (api && api.onShareAppMessage) { try { api.onShareAppMessage(fn); } catch (e) {} }
  },

  /* ---------- 激励视频 ----------
   * 微信: wx.createRewardedVideoAd({ adUnitId })   adUnitId 在 mp 后台"流量主"开通后创建
   * 抖音: tt.createRewardedVideoAd({ adUnitId })   在抖音开放平台"流量变现"创建
   * 两端均为单例：多次 create 返回同一实例。
   * 发奖判据：onClose 回调 res.isEnded === true（老版本基础库 res 可能为 undefined，
   * 兜底按看完处理是平台官方建议）。
   */
  createRewardedVideo: function (adUnitId, onReward, onFail) {
    if (!api || !api.createRewardedVideoAd) {
      // 开发者工具或未开通流量主时的降级：直接判定失败，由调用方提示
      return { show: function () { if (onFail) onFail('no-ad-api'); } };
    }
    var ad = api.createRewardedVideoAd({ adUnitId: adUnitId });
    ad.onError(function (err) { if (onFail) onFail(err); });
    ad.onClose(function (res) {
      if (!res || res.isEnded) { onReward(); }        // 看完 → 发奖
      // 中途退出：不发奖，不惩罚
    });
    return {
      show: function () {
        ad.show().catch(function () {
          // 首次 show 失败按官方建议 load 后重试一次
          ad.load().then(function () { return ad.show(); })
            .catch(function (e) { if (onFail) onFail(e); });
        });
      }
    };
  },

  /* ---------- 生命周期 ---------- */
  onShow: function (fn) { if (api && api.onShow) api.onShow(fn); }
};
