function checkForAutoLoad(){let e="true"===localStorage.getItem("webdash_assets_loaded"),a=parseInt(localStorage.getItem("webdash_last_load_time")||"0"),o=Date.now();return!!(e&&(o-a)/36e5<24&&window.gameCache.isCacheValid())&&!!(window.gameCache.getCacheStats().validEntries>50)&&(console.log("auto loading from cache"),!0)}if(window.gameCache&&(window.gameCache.init(),checkForAutoLoad())){const e=document.createElement("div");e.style.cssText=`
      position: fixed;
      top: 10px;
      right: 10px;
      background: #00ff00;
      color: #000;
      padding: 5px 10px;
      border-radius: 5px;
      font-family: Arial;
      font-size: 12px;
      z-index: 9999;
    `,e.textContent="turbo loading",document.body.appendChild(e),setTimeout(()=>{e.parentNode&&e.parentNode.removeChild(e)},3e3)}const phaserConfig={type:Phaser.AUTO,width:screenWidth,height:screenHeight,resolution:1,fps:{smoothStep:!0},backgroundColor:"#000000",parent:document.body,input:{windowEvents:!1},render:{powerPreference:"default"},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[BootScene,GameScene]};new Phaser.Game(phaserConfig),window.clearGameCache=()=>{window.gameCache&&(window.gameCache.clearCache(),localStorage.removeItem("webdash_assets_loaded"),localStorage.removeItem("webdash_last_load_time"),console.log("Game cache cleared"),location.reload())},window.getCacheInfo=()=>window.gameCache?window.gameCache.getCacheStats():null;
//# sourceMappingURL=Crystal.dae5dda1.js.map
