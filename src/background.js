'use strict'
import { v4 as uuidv4 } from 'uuid';
import _ from 'lodash';
import path from 'path';
import { app, protocol, ipcMain, BrowserWindow } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
const isDevelopment = process.env.NODE_ENV !== 'production'

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

async function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  })
  ipcMain.on("studentDetail",async (event, arg)  => {
    win.webContents.send("startDetail", "開始計算學生數據（" + arg.students.length + "個學生／" + arg.enableGrouping ? '啟動' : '關閉' +"分組）");
    let groups = [];
    if(arg.enableGrouping) {
      let dists = _.uniq(_.map(arg.students, 'grouping'));
      for(let i=0; i<dists.length; i++) {
        groups.push({
          id: uuidv4(),
          name: dists[i],
          students: _.orderBy(_.filter(arg.students, (student) => {
            return student.grouping === dists[i];
          }), ['score'], ['desc'])
        })
      }
    } else {
      groups.push({
        id: uuidv4(),
        name: "全部",
        students: _.orderBy(arg.students, ['score'], ['desc'])
      })
    }
    win.webContents.send("endDetail", groups);
  });
  ipcMain.on("sortStudents", async (event, arg)  => {
    win.webContents.send("startSort", {
      student: arg.students.length,
      class: arg.classCount,
      group: arg.groups.length,
      random: false
    });
    let classes = [];
    for(let i=0; i<arg.classCount; i++) {
      classes.push({
        name: "第" + (i+1) + "班",
        id: uuidv4(),
        students: [],
        order: i
      });
    }
    let rowGroup = [];
    let reverseGrouping = arg.reverse === false ? undefined : true;
    console.dir(reverseGrouping + "/" + arg.reverse);
    for(let k=0; k<arg.groups.length; k++) {
      let groupPoint = 0;
      let reverse = false;
      let times = 1;
      while(arg.groups[k].students.length - groupPoint >= arg.classCount) {
        rowGroup = _.slice(arg.groups[k].students, groupPoint, groupPoint + arg.classCount);
        if(reverseGrouping || reverseGrouping === undefined) {
          if(reverse) rowGroup = _.orderBy(rowGroup, ['score'], ['asc']);
        } else {
          rowGroup = _.orderBy(rowGroup, ['score'], ['asc']);
          if(reverse) rowGroup = _.orderBy(rowGroup, ['score'], ['desc']);
        }
        for(let i=0; i<rowGroup.length; i++) {
          let obj = _.filter(arg.students, (student) => {
            return student.id === rowGroup[i].id;
          });
          classes[i].students.push(obj[0]);
          obj[0].class = classes[i].name;
          obj[0].status = "分配完成";
        }
        groupPoint += arg.classCount
        times++;
        reverse = !reverse;
        win.webContents.send("sortMsg", {
          name: arg.groups[k].name,
          reverse: reverse,
          times: times,
          random: false
        });
      }
      if(reverseGrouping !== undefined) reverseGrouping = !reverseGrouping;
    }
    win.webContents.send("endSort", {
      classes: classes,
      groups: arg.groups,
      students: arg.students
    });
  });
  ipcMain.on("randomAssignment",async (event, arg)  => {
    let unAssigned = _.filter(arg.students, (student) => {
      return student.status != "分配完成";
    })
    let unAssignedGroup = _.uniq(_.map(unAssigned, 'grouping'));
    win.webContents.send("startSort", {
      student: unAssigned.length,
      group: unAssignedGroup.length,
      class: arg.classes.length,
      random: true
    });
    let rowGroup = [];
    for(let i=0; i<arg.classes.length; i++) {
      arg.classes[i].students = _.filter(arg.classes[i].students, (student) => {
        return student.status === "分配完成";
      });
    }
    for(let k=0; k<arg.groups.length; k++) {
      rowGroup = _.shuffle(_.filter(arg.groups[k].students, (student) => {
        return student.status != '分配完成';
      }));
      arg.classes = _.shuffle(arg.classes);
      for(let i=0; i<rowGroup.length; i++) {
        let c = i % arg.classes.length;
        let obj = _.filter(arg.students, (student) => {
          return student.id === rowGroup[i].id;
        });
        arg.classes[c].students.push(obj[0]);
        obj[0].class = arg.classes[c].name;
        obj[0].status = "隨機分配";
      }
      win.webContents.send("sortMsg", {
        name: arg.groups[k].name,
        reverse: false,
        times: 0,
        random: true
      });
    }
    arg.classes = _.orderBy(arg.classes, ['order'], ['asc']);
    win.webContents.send("endSort", arg);
  });
  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    win.loadURL('app://./index.html')
  }
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS_DEVTOOLS)
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString())
    }
  }
  createWindow()
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}
