// main.js — start-up
// LAK風キーキャップジェネレータ / MIT License

applySharedHash();
buildForm();resize();update();showSharedNotice();loop();renderLib();initKm();initLayout();initShare();initStore().then(async()=>{await loadWs();await checkDraft();});
