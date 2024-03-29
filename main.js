var pos; // 坐标系
var f_pos;  // 定位悬浮窗对象
var f_play;  // 演奏悬浮窗对象
var f_select; // 乐谱选择
var f_lrc;  // 歌词悬浮窗对象
var f_btn;  // 按钮悬浮窗对象
var f_touch;  // 记录触摸的悬浮窗对象
var f_auth; // 权限提示悬浮窗
var storage;  // 本地存储对象
var storage_name = 'liang_2uv@qq.com:SKY';  // 本地存储的名字
var storage_key = 'POSITION';  // 存储位置信息的key

var isPlay = false;  // 是否可以弹奏乐谱
var musicDir = '/sdcard/skyMusicPractice/'; // 乐谱文件存放目录
var musicList = []; // 乐谱列表
var musicName; // 乐谱名字
var musicIndex = -1; // 选择的乐谱下标
var musicJSON; // 读取到的乐谱内容（object）
var musicNotes = []; // 解析完成的乐谱内容[{lrc: 'xxx', keys: [[0, 1], [10]], long: [1]}]
var musicRow = 0;  // 当前弹奏的歌词下标
var musicKey = -1;  // 当前弹奏的歌词key下标
var musicKeyMap = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'C1'];
var _musicRow = -1;  // 当前弹奏的歌词下标（缓存）
var _musicKey = -1;  // 当前弹奏的歌词key下标（缓存）

var x = 300;  // 弹奏框x坐标
var y = 120;  // 弹奏框y坐标
var playW = 1061;  // 弹奏框宽度
var playH = 616;  // 弹奏框高度
var keySize = 171;  // 按键大小
var spanSize = 51.5; // 按键间隔
var posExt = 70;  // 悬浮窗定位需要额外减去的宽度和高度

var eventSub;

var touchArr = [];  // 手指触控点
var vrx = 0, vry = 0; //屏幕坐标差。
var isAuth = false;

importClass(android.widget.TextView)
importClass(android.view.WindowManager);
importClass(android.view.inputmethod.EditorInfo);

(function() {
  tip('请开启【无障碍】【悬浮窗】【访问设备信息】三种权限，遇到问题请联系开发者wx:Liang2uv —— 光遇·六六', 'alert');
  posInit();
  musicItems(); // 1. 获取乐谱列表
  if (!this.musicList.length) { return; }
  storage = storages.create(storage_name);
  if (storage.contains(storage_key)) {  // 自定义过按键坐标
    const obj = storage.get(storage_key);
    pos = obj.pos;
    x = obj.x;
    y = obj.y;
    playW = obj.playW;
    playH = obj.playH;
    keySize = obj.keySize;
    spanSize = obj.spanSize;
    log(JSON.stringify(obj))
    tip('初始化按键坐标完毕');
  }
  eventListen();
  f_tbnOpen();
  f_lrcOpen();
  f_playOpen();
  f_touchOpen();
  f_posOpen();
  f_selectOpen();
  f_authOpen();
  while(true) {}
})();

function posInit() {
  x = px2px(x);
  y = px2px(y);
  playW = px2px(playW);
  playH = px2px(playH);
  keySize = px2px(keySize);
  spanSize = px2px(spanSize);
  posExt = px2px(posExt);
}

function eventListen() {
  if (!eventSub) {
    eventSub = events.emitter();
    eventSub.on('musicSelect', function() {
      if (!pos) { tip('请先定位按键坐标'); return; }
      auth();
      if (!isAuth) { return; }
      f_touch.setTouchable(false);
      f_play.board.setVisibility(4);
      f_lrc.board.setVisibility(4);
      f_lrc.setAdjustEnabled(false);
      musicSelect();  // 2. 选择/读取乐谱
    });
    eventSub.on('musicParse', function() {
      musicParse(); // 3. 解析乐谱完毕
    });
    eventSub.on('playing', function() {
      if (isPlay) {
        dialogs.confirm('提示', '即将练习《' + musicName + '》', (ret) => {
          if (ret) {
            play();
          }
        });
      }
    });
    eventSub.on('playPre', function() {
      if (!musicNotes || !musicNotes.length) {
        tip('请先选择乐谱');
        return;
      }
      if (musicRow === 0 && musicKey === 0) {
        tip('已经是开始位置了');
        return;
      }
      if (musicKey === 0) {  // 上一行歌词
        musicRow--;
        musicKey = musicNotes[musicRow].keys.length - 1;
      } else {
        musicKey--;
      }
      const key = musicNotes[musicRow].keys[musicKey];
      for(let i = 0; i < 15; i++) { // 键位变化
        if (key.indexOf(i) > -1) {
          if (musicNotes[musicRow].long.indexOf(musicKey) > -1) { //  长按是红色
            f_play['playbtn' + i].attr("bg", "#77aa0000");
          } else {
            f_play['playbtn' + i].attr("bg", "#7744cc00");
          }
        } else {
          f_play['playbtn' + i].attr("bg", "#00000000");
        }
      }
      lrcChange();
    });
    eventSub.on('playNext', function() {
      if (!musicNotes || !musicNotes.length) {
        tip('请先选择乐谱');
        return;
      }
      if (musicRow === musicNotes.length - 1 && musicKey === musicNotes[musicRow].keys.length - 1) {
        tip('已经是结束位置了');
        return;
      }
      if (musicKey === musicNotes[musicRow].keys.length - 1) {  // 下一行歌词
        musicRow++;
        musicKey = 0;
      } else {
        musicKey++;
      }
      const key = musicNotes[musicRow].keys[musicKey];
      for(let i = 0; i < 15; i++) { // 键位变化
        if (key.indexOf(i) > -1) {
          if (musicNotes[musicRow].long.indexOf(musicKey) > -1) { //  长按是红色
            f_play['playbtn' + i].attr("bg", "#77aa0000");
          } else {
            f_play['playbtn' + i].attr("bg", "#7744cc00");
          }
        } else {
          f_play['playbtn' + i].attr("bg", "#00000000");
        }
      }
      lrcChange();
    });
    eventSub.on('posOpen', function() {
      if (f_touch) {
        f_touch.board.setVisibility(4);
        f_touch.setTouchable(false);
      }
      if (f_play) {
        f_play.board.setVisibility(4);
      }
      if (f_lrc) {
        f_lrc.board.setVisibility(4);
        f_lrc.setAdjustEnabled(false);
      }
      musicIndex = -1;
      musicNotes = [];
      musicRow = 0;
      musicKey = -1;
      _musicRow = 0;
      _musicKey = -1;
      f_btn.btn_position.setText('定位好了');
      f_btn.btn_pre.setVisibility(8);
      f_btn.btn_next.setVisibility(8);
      f_btn.btn_play_start.setVisibility(8);
      f_btn.btn_play_restart.setVisibility(8);
      f_btn.btn_free.setVisibility(8);
      f_pos.setSize(playW * 1.5, playH * 1.5)
      f_pos.setPosition(300, 120);
      f_pos.board.setVisibility(0);
      f_pos.setAdjustEnabled(true);
      let parentParent = f_pos.board.parent.parent.parent;
      setTouchable(parentParent, true);
    });
    eventSub.on('posFinish', function() {
      x = f_pos.getX();
      y = f_pos.getY();
      playW = f_pos.getWidth() - posExt;
      playH = f_pos.getHeight() - posExt;
      let ret = divideTwoCellOnce(3, 2, playH, 5, 4, playW);
      keySize = ret.x;
      spanSize = ret.y;
      pos = getPos(x + keySize/2, y + keySize / 2, keySize + spanSize);
      let obj = storage.get(storage_key) || {};
      obj.pos = pos;
      obj.x = x;
      obj.y = y;
      obj.playW = playW;
      obj.playH = playH;
      obj.keySize = keySize;
      obj.spanSize = spanSize;
      storage.put(storage_key, obj);
      f_btn.btn_position.setText('开始定位');
      f_btn.btn_pre.setVisibility(8);
      f_btn.btn_next.setVisibility(8);
      f_btn.btn_play_start.setVisibility(0);
      f_btn.btn_play_restart.setVisibility(8);
      f_btn.btn_free.setVisibility(8);
      f_play.setSize(playW, playH);
      f_play.setPosition(x, y);
      for (let i = 0; i < 15; i++) {
        let marginRight = spanSize;
        let marginBottom = spanSize;
        if ((i + 1) % 5 == 0) {
          marginRight = 0;
        }
        if (i >= 10) {
          marginBottom = 0;
        }
        setLayoutParams(f_play['playbtn' + i], keySize, keySize, 0, 0, marginRight, marginBottom);
      }
      f_touch.setSize(playW, playH);
      f_touch.setPosition(x, y);
      f_lrc.setPosition(x, y + playH + px2px(50))
      f_lrc.setSize(playW, px2px(200))
      f_pos.board.setVisibility(4);
      f_pos.setAdjustEnabled(false);
      let parentParent = f_pos.board.parent.parent.parent;
      setTouchable(parentParent, false);
      tip('初始化按键坐标完毕');
    });
    eventSub.on('gestures', function() {
      f_touch.setTouchable(false);
      threads.start(function () {
        sleep(70);
        let gestureStr = JSON.stringify(touchArr);
        log('gestures(' + gestureStr.substr(1, gestureStr.length - 2) + ');')
        eval('gestures(' + gestureStr.substr(1, gestureStr.length - 2) + ');');
        // sleep(70);
        f_touch.setTouchable(true);
      })
      eventSub.emit('playNext');
    });
  }
}

function f_authOpen() {
  if (f_auth) { return; }
  f_auth = floaty.window(
    <frame id="board"  bg="#ffffffff">
      <vertical padding="15 15 15 0">
        <text paddingBottom="20" textSize="17sp" textColor="#fffc5532" text="请加我wx: Liang2uv 支付 ¥15 获取密钥" gravity="center"/>
        <input id="pass" hint="请输入密钥" textColorHint="#ffbbbbbb" android:imeOptions="actionDone" singleLine="true" focusable="true"/>
        <horizontal paddingTop="10" gravity="right">
          <text id="exit" size="16sp" color="#454545">退出</text>
          <text layout_weight="1"></text>
          <text id="copy" size="16sp" color="#00aadd">复制key</text>
          <text id="submit" size="16sp" color="#00aadd" marginLeft="30">验证密钥</text>
        </horizontal>
      </vertical>
    </frame>
  );
  f_auth.setSize(device.height - 700, device.width - 100);
  f_auth.setPosition(350, 50);
  f_auth.pass.on("touch_down", ()=>{
    f_auth.requestFocus();
    f_auth.pass.requestFocus();
  });
  f_auth.exit.click(function() {
    exit();
  });
  f_auth.copy.click(function() {
    setClip(androidId());
    tip('已复制到剪切板', 'alert');
  });
  f_auth.submit.click(function() {
    let text = f_auth.pass.getText().toString();
    let d = new Date();
    if (!text) {
      tip('请输入密钥', 'alert');
      return;
    }
    if (text === md5(d.getFullYear() + '-' + (1 + d.getMonth()) + '-' + d.getDate() + androidId() + 'YT520P')) {
      tip('验证通过');
      isAuth = true;
      let obj = storage.get(storage_key) || {};
      obj.authPractice = -1;
      storage.put(storage_key, obj);
      f_auth.close();
    } else {
      tip('验证失败，请输入正确密钥', 'alert');
    }
  });
  f_auth.board.setVisibility(8);
  let parentParent = f_auth.board.parent.parent.parent;
  setTouchable(parentParent, false);
}

function f_tbnOpen() {
  f_btn = floaty.rawWindow(
    <frame id="board">
      <ScrollView h="{{device.width}}px" scrollbars="none">
        <vertical gravity="left">
          <button id="btn_exit" text="退出"/>
          <button id="btn_play_start" text="选择乐谱"/>
          <button id="btn_play_restart" text="重新练习"/>
          <button id="btn_pre" text="上一个"/>
          <button id="btn_next" text="下一个"/>
          <button id="btn_free" text="自由练习"/>
          <button id="btn_position" text="开始定位"/>
        </vertical>
      </ScrollView>
    </frame>
  );
  f_btn.setPosition(0, 0);
  f_btn.btn_exit.click(function() {
    exit();
  });
  f_btn.btn_play_start.click(function() {
    eventSub.emit('musicSelect');
  });
  f_btn.btn_play_restart.click(function() {
    if (!isAuth) { return; }
    if (!musicNotes || !musicNotes.length) {
      tip('请先选择乐谱');
      return;
    }
    f_touch.setTouchable(false);
    f_play.board.setVisibility(4);
    f_lrc.board.setVisibility(4);
    f_lrc.setAdjustEnabled(false);
    dialogs.confirm('提示', '即将练习《' + musicName.substr(0, musicName.indexOf('.txt')) + '》', (ret) => {
      if (ret) {
        play();
      } else {
        f_touch.setTouchable(true);
        f_play.board.setVisibility(0);
        f_lrc.board.setVisibility(0);
        f_lrc.setAdjustEnabled(true);
      }
    });
  });
  f_btn.btn_pre.click(function() {
    if (!isAuth) { return; }
    eventSub.emit('playPre');
  });
  f_btn.btn_next.click(function() {
    if (!isAuth) { return; }
    eventSub.emit('playNext');
  });
  f_btn.btn_free.click(function() {
    if (!isAuth) { return; }
    if (f_btn.btn_free.getText() == '自由练习') {
      tip('已进入自由练习模式');
      f_touch.setTouchable(false);
      f_btn.btn_free.setText('退出自由');
    } else {
      tip('已退出自由练习模式');
      f_touch.setTouchable(true);
      f_btn.btn_free.setText('自由练习');
    }
  });
  f_btn.btn_pre.setVisibility(8);
  f_btn.btn_next.setVisibility(8);
  f_btn.btn_play_restart.setVisibility(8);
  f_btn.btn_free.setVisibility(8);
  f_btn.btn_position.click(function() {
    if (f_btn.btn_position.getText() == '定位好了') {  // 定位好了
      eventSub.emit('posFinish');
    } else {  // 开始定位
      eventSub.emit('posOpen');
    }
  });
}

function f_lrcOpen() {
  if (f_lrc) { return; }
  f_lrc = floaty.window(
    <frame id="board" bg="#22ffcc00">
      <vertical w="*" h="*" padding="5">
        <HorizontalScrollView id="scrollKey" w="*" scrollbars="none">
          <horizontal id="layh">
          </horizontal>
        </HorizontalScrollView>
        <HorizontalScrollView id="scrollLrc"  w="*">
          <text id="lrcText" text="歌词" textColor="#ffffffff" textSize="12sp"/>
        </HorizontalScrollView>
      </vertical>
    </frame>
  );
  f_lrc.board.setVisibility(4);
  f_lrc.setAdjustEnabled(false);
  f_lrc.setSize(playW, px2px(200));
  f_lrc.setPosition(x, y + playH + px2px(50))
  let parentParent = f_lrc.board.parent.parent.parent;
  setTouchable(parentParent, true);
}

function f_playOpen() {
  if (f_play) { return; }
  f_play = floaty.rawWindow(
    <vertical>
      <frame id="board" gravity="center">
        <vertical w="*" h="*">
          <horizontal>
            <button marginBottom="{{vl(spanSize)}}" id="playbtn0" w="{{vl(keySize)}}" h="{{vl(keySize)}}" marginRight="{{vl(spanSize)}}" text="A1" textColor="#ffffffff" bg="#44AA0000"/>
            <button marginBottom="{{vl(spanSize)}}" id="playbtn1" marginRight="{{vl(spanSize)}}" text="A2" textColor="#ffffffff" w="{{vl(keySize)}}" h="{{vl(keySize)}}" bg="#44AA0000"/>
            <button marginBottom="{{vl(spanSize)}}" id="playbtn2" marginRight="{{vl(spanSize)}}" text="A3" textColor="#ffffffff" w="{{vl(keySize)}}" h="{{vl(keySize)}}" bg="#44AA0000"/>
            <button marginBottom="{{vl(spanSize)}}" id="playbtn3" marginRight="{{vl(spanSize)}}" text="A4" textColor="#ffffffff" w="{{vl(keySize)}}" h="{{vl(keySize)}}" bg="#44AA0000"/>
            <button marginBottom="{{vl(spanSize)}}" id="playbtn4" text="A5" textColor="#ffffffff" w="{{vl(keySize)}}" h="{{vl(keySize)}}" bg="#44AA0000"/>
          </horizontal>
          <horizontal>
            <button marginBottom="{{vl(spanSize)}}" id="playbtn5" marginRight="{{vl(spanSize)}}" text="A6" textColor="#ffffffff" w="{{vl(keySize)}}" h="{{vl(keySize)}}" bg="#44AA0000"/>
            <button marginBottom="{{vl(spanSize)}}" id="playbtn6" marginRight="{{vl(spanSize)}}" text="A7" textColor="#ffffffff" w="{{vl(keySize)}}" h="{{vl(keySize)}}" bg="#44AA0000"/>
            <button marginBottom="{{vl(spanSize)}}" id="playbtn7" marginRight="{{vl(spanSize)}}" text="B1" textColor="#ffffffff" w="{{vl(keySize)}}" h="{{vl(keySize)}}" bg="#44AA0000"/>
            <button marginBottom="{{vl(spanSize)}}" id="playbtn8" marginRight="{{vl(spanSize)}}" text="B2" textColor="#ffffffff" w="{{vl(keySize)}}" h="{{vl(keySize)}}" bg="#44AA0000"/>
            <button marginBottom="{{vl(spanSize)}}" id="playbtn9" text="B3" textColor="#ffffffff" w="{{vl(keySize)}}" h="{{vl(keySize)}}" bg="#44AA0000"/>
          </horizontal>
          <horizontal>
            <button id="playbtn10" marginRight="{{vl(spanSize)}}" text="B4" textColor="#ffffffff" w="{{vl(keySize)}}" h="{{vl(keySize)}}" bg="#44AA0000"/>
            <button id="playbtn11" marginRight="{{vl(spanSize)}}" text="B5" textColor="#ffffffff" w="{{vl(keySize)}}" h="{{vl(keySize)}}" bg="#44AA0000"/>
            <button id="playbtn12" marginRight="{{vl(spanSize)}}" text="B6" textColor="#ffffffff" w="{{vl(keySize)}}" h="{{vl(keySize)}}" bg="#44AA0000"/>
            <button id="playbtn13" marginRight="{{vl(spanSize)}}" text="B7" textColor="#ffffffff" w="{{vl(keySize)}}" h="{{vl(keySize)}}" bg="#44AA0000"/>
            <button id="playbtn14" text="C1" textColor="#ffffffff" w="{{vl(keySize)}}" h="{{vl(keySize)}}" bg="#44AA0000"/>
          </horizontal>
        </vertical>
      </frame>
    </vertical>
  );
  f_play.setSize(playW, playH);
  f_play.setPosition(x, y)
  f_play.setTouchable(false);
  f_play.board.setVisibility(4);
}

function vl(x) {
  return parseInt(x) + "px"
}

function f_touchOpen() {
  if (f_touch) { return; }
  f_touch = floaty.rawWindow(
    <frame id="board" gravity="center">
    </frame>
  );
  f_touch.setSize(playW, playH);
  f_touch.setPosition(x, y)
  f_touch.board.setVisibility(4);
  f_touch.setTouchable(false);
  f_touch.board.setOnTouchListener(new android.view.View.OnTouchListener((view, event) => {
    var I = Math.floor(event.getAction() / 256);
    var RX = event.getRawX();
    var RY = event.getRawY();
    switch (event.getActionMasked()) {
      case event.ACTION_MOVE:
        return true;
      case event.ACTION_DOWN:
        var X = event.getX(I);
        var Y = event.getY(I);
        vrx = RX - X, vry = RY - Y;
        touchArr = [[0, 1, [Math.floor(x + X), Math.floor(y + Y)], [Math.floor(x + X), Math.floor(y + Y)]]];
        touchArr = [[0, 1, [Math.floor(X + vrx), Math.floor(Y + vry)], [Math.floor(X + vrx), Math.floor(Y + vry)]]];
        return true;
      case event.ACTION_UP:
        eventSub.emit('gestures');
        return true;
      case event.ACTION_POINTER_DOWN:
        var X = event.getX(I);
        var Y = event.getY(I);
        touchArr.push([0, 1, [Math.floor(X + vrx), Math.floor(Y + vry)], [Math.floor(X + vrx), Math.floor(Y + vry)]]);
        return true;
      case event.ACTION_POINTER_UP:
        return true;
      default:
        return true;
    }
  }))
}

function f_selectOpen() {
  f_select = floaty.rawWindow(
    <frame id="board" w="*" h="*" gravity="center">
      <vertical w="{{ device.height / 2 }}px" height="{{ device.width - 160 }}px" bg="#ffffffff">
        <horizontal id="search" w="*" bg="#ffefefef">
          <text id="btnSearch" padding="15" textSize="15sp" textColor="#ff0f9086">搜索</text>
          <input id="input" layout_weight="1" inputType="text" hint="输入关键词" textColorHint="#ffbbbbbb" android:imeOptions="actionDone" singleLine="true" focusable="true" focusableInTouchMode="true"></input>
          <text id="btnClear" padding="15" textSize="15sp" textColor="#ff0f9086">清除</text>
        </horizontal>
        <list id="list" w="*">
          <horizontal padding="10" w="*"><text textSize="15sp" textColor="#ff666666" text="{{this.name}}" w="*"></text></horizontal>
        </list>
      </vertical>
    </frame>
  );
  f_select.setSize(-1, -1);
  f_select.board.setVisibility(8);
  f_select.setTouchable(false);
  f_select.board.on('touch_down', () => {
    f_select.input.clearFocus();
    f_select.disableFocus();
    f_select.board.setVisibility(8);
    f_select.setTouchable(false);
    if (musicNotes.length) {  // 不选了，继续练习
      f_touch.setTouchable(true);
      f_play.board.setVisibility(0);
      f_lrc.board.setVisibility(0);
      f_lrc.setAdjustEnabled(true);
    }
  });
  f_select.input.setOnEditorActionListener(new android.widget.TextView.OnEditorActionListener((view, i, event) => {
    switch (i) {
      case EditorInfo.IME_ACTION_DONE:
        let keyword = f_select.input.getText().toString().trim();
        f_select.list.setDataSource(musicList.filter(v => {
          if (!keyword) {
            return true;
          }
          return v.indexOf(keyword) > -1;
        }).map(v => ({ name: v })));
        f_select.input.clearFocus();
        f_select.disableFocus();
        return false;
      default:
        return true;
    }
    
  }));
  f_select.input.on("touch_down", ()=> {
    f_select.requestFocus();
    f_select.input.requestFocus();
  });
  f_select.btnSearch.click(function() {
    let keyword = f_select.input.getText().toString().trim();
    f_select.list.setDataSource(musicList.filter(v => {
      if (!keyword) {
        return true;
      }
      return v.indexOf(keyword) > -1;
    }).map(v => ({ name: v })));
    f_select.input.clearFocus();
    f_select.disableFocus();
  });
  f_select.btnClear.click(function() {
    if (!f_select.input.getText().toString()) { return; }
    f_select.input.setText('');
    f_select.list.setDataSource(musicList.map(v => ({ name: v })));
  });
  f_select.list.on("item_click", function(item, itemView) {
    if (!files.isFile(musicDir + item.name + '.txt')) { tip('乐谱文件不存在, 请将乐谱文件(xxx.txt)复制到skyMusicPractice文件夹下', 'alert'); return; }
    try {
      let readable = files.open(musicDir + item.name + '.txt', 'r', 'x-UTF-16LE-BOM');
      let parsed = eval(readable.read())[0];
      readable.close();
      if(typeof(parsed.songNotes[0]) == 'number' || parsed.isEncrypted) {
        tip('乐谱文件已加密，无法弹奏，请更换乐谱', 'alert');
      } else {
        tip('读取乐谱成功');
        musicJSON = parsed;
        musicName = item.name;
        log(musicName);
        isPlay = true;
        f_select.input.clearFocus();
        f_select.disableFocus();
        f_select.board.setVisibility(8);
        f_select.setTouchable(false);
        eventSub.emit('musicParse');
      }
    } catch (err) {
      try {
        let readable = files.open(musicDir + item.name + '.txt', 'r', 'UTF-8');
        let parsed = eval(readable.read())[0];
        readable.close();
        if(typeof(parsed.songNotes[0]) == 'number' || parsed.isEncrypted) {
          tip('乐谱文件已加密，无法弹奏，请更换乐谱', 'alert');
        } else {
          tip('读取乐谱成功');
          musicJSON = parsed;
          musicName = item.name;
          log(musicName);
          isPlay = true;
          f_select.board.setVisibility(8);
          f_select.setTouchable(false);
          eventSub.emit('musicParse');
        }
      } catch (error) {
        log(error)
        tip('读取乐谱失败，请更换乐谱文件', 'alert');
      }
    }
  });
  f_select.list.setDataSource(musicList.map(v => ({ name: v })));
}

function exit() {
  floaty.closeAll();
  threads.shutDownAll();
  engines.stopAll();
}

function f_posOpen() {
  if (f_pos) { return; }
  f_pos = floaty.window(
    <frame id="board" gravity="center" bg="#44ffcc00">
      <vertical w="*" h="*" gravity="center">
        <text color="#ffffff" gravity="center" w="*">请将本区域与全部琴键区域重叠</text>
      </vertical>
    </frame>
  );
  f_pos.board.setVisibility(4);
  f_pos.setSize(playW * 1.5, playH * 1.5);
  f_pos.setPosition(300, 120);
  f_pos.setAdjustEnabled(false);
  let parentParent = f_pos.board.parent.parent.parent;
  setTouchable(parentParent, false);
}

/**
 * @method 悬浮窗是否可触摸设置
 * @param {*} view 悬浮窗父对象
 * @param {*} touchable 是否可触摸
 */
function setTouchable(view, touchable) {
  let params = view.getLayoutParams();
  if (touchable) {
    params.flags &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
  } else {
    params.flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;
  }
  windowManager = context.getSystemService(context.WINDOW_SERVICE);
  ui.run(function () {
    windowManager.updateViewLayout(view, params);
  });
}

/**
 * @method 获取乐谱列表
 */
 function musicItems() {
  if (files.isDir(musicDir)) {
    musicList = files.listDir(musicDir, function (name) {
      return name.endsWith('.txt') && files.isFile(files.join(musicDir, name));
    }).map(v => v.replace(/.txt$/, ''));
    sort(musicList);
    if (!musicList.length) {
      // tip('查询不到乐谱文件，请将乐谱文件放在skyMusicPractice目录下', 'alert');
      fileCopy('./res/music/', musicDir);
    }
  } else {
    // tip('skyMusicPractice文件夹不存在');
    if (files.create(musicDir)) {
      // tip('创建文件夹skyMusicPractice成功，请将谱子放入该文件夹', 'alert');
      fileCopy('./res/music/', musicDir);
    } else {
      tip('创建文件夹失败，请在根目录手动创建文件夹skyMusicPractice', 'alert');
    }
  }
}

/**
 * @method 选择/读取乐谱
 */
function musicSelect() {
  isPlay = false;
  musicIndex = -1;
  if (!musicList.length) { return; }
  f_select.board.setVisibility(0);
  f_select.setTouchable(true);
}

/**
 * @method 解析乐谱
 */
function musicParse() {
  if (!isPlay) { return; }
  log('开始解析')
  let time = musicJSON.songNotes[0].time;
  let row = 0;
  musicNotes = [{
    keys: [[]],
    lrc: musicJSON.custom ? musicJSON.lrc[row].text : '',
    time: musicJSON.custom ? musicJSON.lrc[row].time : [],
    long: []
  }];
  for (let i = 0; i < musicJSON.songNotes.length; i++) {
    let item = musicJSON.songNotes[i];
    if (item.key) {
      let key = Number(item.key.replace(/^(?:\d)?Key(\d{1,})$/, '$1'));
      if (item.time === time) { // 同时按下
        musicNotes[musicNotes.length - 1].keys[musicNotes[musicNotes.length - 1].keys.length - 1].push(key);
      } else {  // 新按下
        time = item.time;
         // 自定义乐谱，按歌词分段, 非自定义乐谱，只有一段
        if ((musicJSON.custom && item.time > musicNotes[musicNotes.length - 1].time[1])) {
          row++;
          musicNotes.push({
            keys: [[key]],
            lrc: musicJSON.custom ? musicJSON.lrc[row].text : '',
            time: musicJSON.custom ? musicJSON.lrc[row].time : [],
            long: []
          })
        } else {
          musicNotes[musicNotes.length - 1].keys.push([key]);
        }
      }
      if (item.long) {
        const keyI =  musicNotes[musicNotes.length - 1].keys.length - 1;
        if (musicNotes[musicNotes.length - 1].long.indexOf(keyI) < 0) {
          musicNotes[musicNotes.length - 1].long.push(keyI);
        }
      }
    }
  }
  tip('解析乐谱完毕');
  eventSub.emit('playing');
}


/**
 * @method 弹奏
 */
function play() {
  if (!isPlay) {
    return;
  }
  f_play.board.setVisibility(0);
  f_lrc.board.setVisibility(0);
  f_lrc.setAdjustEnabled(true);
  f_touch.board.setVisibility(0);
  f_touch.setTouchable(true);
  f_btn.btn_pre.setVisibility(0);
  f_btn.btn_next.setVisibility(0);
  f_btn.btn_play_start.setVisibility(0);
  f_btn.btn_play_restart.setVisibility(0);
  f_btn.btn_free.setVisibility(0);
  musicKey = -1;
  musicRow = 0;
  _musicRow = -1;
  musicKey = -1;
  eventSub.emit('playNext');
}

function lrcChange() {
  let changeRow = false;  // 是否换行
  if (_musicRow !== musicRow) {
    _musicRow = musicRow;
    _musicKey = -1;
    f_lrc.layh.removeAllViews();
    for (let i = 0; i < musicNotes[musicRow].keys.length; i++) {
      let text = musicNotes[musicRow].keys[i].map(k => {
        if (musicNotes[musicRow].long.indexOf(i) > -1) {
          return musicKeyMap[k] + '~';
        }
        return musicKeyMap[k];
      }).join('');
      let child = new TextView(context);
      child.setText(text);
      child.setTextSize(14);
      child.setTextColor(colors.parseColor("#ffffff"));
      setMargins(child, 0, 0, 20, 0);
      f_lrc.layh.addView(child);
    }
    f_lrc.lrcText.setText(musicNotes[musicRow].lrc);
    changeRow = true;
  }
  if (_musicKey !== musicKey) {
    if (f_lrc.layh.getChildAt(_musicKey)) {
      f_lrc.layh.getChildAt(_musicKey).attr("bg", "#00000000");
    }
    _musicKey = musicKey;
    if (f_lrc.layh.getChildAt(_musicKey)) {
      f_lrc.layh.getChildAt(_musicKey).attr("bg", "#77cc4400");
      if (changeRow) {
        let t = setTimeout(() => {
          clearTimeout(t);
          let scroll = f_lrc.layh.getChildAt(_musicKey).getLeft() + f_lrc.layh.getChildAt(_musicKey).getWidth() + 20 - f_lrc.scrollKey.getWidth();
          if (scroll < 0) { scroll = 0; }
          f_lrc.scrollKey.scrollTo(scroll, 0);
        }, 10);
      } else {
        let scroll = f_lrc.layh.getChildAt(_musicKey).getLeft() + f_lrc.layh.getChildAt(_musicKey).getWidth() + 20 - f_lrc.scrollKey.getWidth();
        if (scroll < 0) { scroll = 0; }
        f_lrc.scrollKey.scrollTo(scroll, 0);
      }
    }
  }
}

function auth() {
  try {
    device.getAndroidId();
  } catch (error) {
    log('请在系统设置中开启auto.js的“访问设备信息”权限');
  }
  const obj = storage.get(storage_key) || {};
  let now = Date.now();
  if (!obj.authPractice) {
    obj.authPractice = now + 86400000;
    storage.put(storage_key, obj);
  }
  if (obj.authPractice != -1 && obj.authPractice < now) {
    isAuth = false;
    f_auth.board.setVisibility(0);
    let parentParent = f_auth.board.parent.parent.parent;
    setTouchable(parentParent, true);
  } else {
    isAuth = true;
  }
}

function setMargins(view,left,top,right,bottom) {
  var margin = new android.widget.LinearLayout.LayoutParams(android.view.ViewGroup.LayoutParams.WRAP_CONTENT, android.view.ViewGroup.LayoutParams.WRAP_CONTENT);
  margin.setMargins(left, top, right,bottom);
  view.setLayoutParams(margin);
}
  
function setLayoutParams(view,width,height,left,top,right,bottom){
  var layoutParams = new android.widget.LinearLayout.LayoutParams(view.getLayoutParams());
  layoutParams.setMargins(left, top, right, bottom);
  layoutParams.width = width;
  layoutParams.height = height;
  view.setLayoutParams(layoutParams);
}

/**
 * @method 初始化按键坐标
 * @param x 第一个按键x坐标
 * @param y 第一个按键y坐标
 * @param span 按键间隔
 */
 function getPos(x, y, span) {
  let position = {};
  for (let i = 0; i < 15; i++) {
    position[i] = {
      x: x + (i % 5) * span,
      y: y + Math.floor(i / 5) * span
    };
  }
  return position;
}

/**
 * @method 数组排序（中文+英文）
 * @param arr 需要排序的数组
 */
function sort(arr) {
  arr.sort(function (item1, item2) {
    return item1.localeCompare(item2);
  });
}

/**
 * @method 提示
 */
function tip(text, type) {
  if (type === 'alert') {
    alert(text);
  } else {
    toast(text);
  }
  log(text);
}

function divideTwoCellOnce(a, b, c, k, f, s) {
  let y = (c*k - s*a)/(b*k - a*f);
  let x = (c - b*y)/a;
  return {
    x: x,
    y: y
  }
}

function androidId() {
  let d = new Date();
  try {
    return device.getAndroidId() || ('a23187' + d.getFullYear() + (1 + d.getMonth()) + d.getDate());
  } catch (error) {
    return 'a23187' + d.getFullYear() + (1 + d.getMonth()) + d.getDate();
  }
}

function md5(string) {
  return java.math.BigInteger(1,java.security.MessageDigest.getInstance("MD5")
  .digest(java.lang.String(string).getBytes())).toString(16);
}

function px2px(px) {
  let dpi = context.getResources().getDisplayMetrics().xdpi;
  return Math.ceil(px/403*dpi);
}

function fileCopy(fromPath, toPath) {
  /*格式:H.copy(原文件路径,要复制到的路径);*/
  /*解释:复制文件或文件夹（已存在则跳过） 返回是否复制成功*/
  fromPath = files.path(fromPath);
  toPath = files.path(toPath);
  var rp = /^([/][^\/:*?<>|]+[/]?)+$/;
  var rp1 = /^([/][^\/:*?<>|]+)+$/;
  var rp2 = /^([/][^\/:*?<>|]+)+[/]$/;
  try {
    if (rp.test(fromPath) == false || files.exists(fromPath) == false) throw "非法原文件地址,H.copy(?,);" + fromPath;
    if (rp.test(toPath) == false) throw "非法要复制到的路径地,H.copy(,?);" + toPath;
    if (rp1.test(fromPath) == true && rp1.test(toPath) == false) throw "非法要复制到的地址,H.copy(,?);" + toPath;
    if (rp2.test(fromPath) == true && rp2.test(toPath) == false) throw "非法要复制到的地址,H.copy(,?);" + toPath;
  } catch (err) {
    log(err);
    exit();
  }
  if (rp1.test(fromPath) == true) {
    /*复制文件*/
    return files.copy(fromPath, toPath);
  } else if (rp2.test(fromPath)) {
    /*复制文件夹*/
    /*获取原文件路径文件和文件夹*/
    var arr = getFilesFromPath(fromPath);
    /*遍历文件路径数组*/
    for (var i = 0; i < arr.length; i++) {
      /*原文件路径替换成目的路径*/
      var path = arr[i].replace(fromPath, toPath);
      /*判断路径类型*/
      if (files.isDir(arr[i])) {
        /*创建目的文件夹*/
        files.createWithDirs(path + "/");
      } else if (!files.exists(path) && files.isFile(arr[i])) {
        /*复制文件到目的文件路径*/
        files.copy(arr[i], path);
      }
    }
    /*获取目的路径文件和文件夹*/
    var arrToPath = getFilesFromPath(toPath);
    /*通过对比原文件和目的文件数量来返回是否复制成功*/
    if (arr.length <= arrToPath.length) {
      return true;
    } else {
      return false;
    }
  }
}

function getFilesFromPath(path) {
  /*格式:H.getFilesFromPath(文件夹路径)*/
  /*解释:获取指定路径所有文件和文件夹 递归遍历 返回文件路径数组*/
  path = files.path(path);
  var arrDir = new Array();
  var arrFile = new Array();
  try {
      var rp = /^([/][^\/:*?<>|]+[/]?)+$/;
      if (rp.test(path) == false) throw "非法文件路径,H.getFilesFromPath(?);" + path;
  } catch (err) {
      log(err);
      exit();
  }
  /*获取path目录下所有文件夹和文件*/
  var arr = files.listDir(path);
  /*遍历文件和文件夹*/
  for (var i = 0; i < arr.length; i++) {
    /*连接路径*/
    newPath = files.join(path, arr[i]);
    /*判断路径类型*/
    if (files.isDir(newPath)) {
      arrDir.push(newPath);
      /*递归遍历文件夹*/
      var arrF = getFilesFromPath(newPath);
      arrDir = arrDir.concat(arrF);
    } else if (files.isFile(newPath)) {
      /*过滤隐藏文件*/
      if (arr[i].slice(0, 1) != ".") {
        arrFile.push(newPath);
      }
    }
  }
  /*按字母升序排序数组*/
  arrDir.sort();
  arrFile.sort();
  /*连接数组并返回*/
  return arrDir.concat(arrFile);
}