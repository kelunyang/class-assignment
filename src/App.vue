<template>
  <v-app>
    <v-main>
      <v-dialog
        v-model="studentDataW"
        fullscreen
        hide-overlay
        transition="dialog-bottom-transition"
      >
        <v-card>
          <v-toolbar
            dark
            color="primary"
          >
            <v-btn
              icon
              dark
              @click="buildstudentList"
            >
              <v-icon>fa-times-circle</v-icon>
            </v-btn>
            <v-toolbar-title>選擇學生清單CSV匯出檔案並讀入</v-toolbar-title>
          </v-toolbar>
          <v-card-text class='d-flex flex-column ma-1'>
            <v-alert type="info" icon="fa-info" v-if='students.length === 0'>
              請先準備好學生清單CSV匯出檔案，請注意，系統會排除唯一欄位中重複的值
            </v-alert>
            <v-alert type="info" icon="fa-info" v-if='studentData.length > 0'>一共讀入了{{ studentData.length }}行資料，請在下方設定好欄位對應</v-alert>
            <v-alert type="error" icon="fa-skull" v-if='studentError !== ""'>{{ studentError }}</v-alert>
            <v-btn class='ma-1 indigo darken-4 white--text' @click="downloadCSV(sampleStudents, '學生範例')">下載範例檔</v-btn>
            <v-file-input accept="text/csv" prepend-icon='fa-file-csv' outlined v-model="studentFile" placeholder="請選擇學生名單CSV檔案"/>
            <div class='text-body-1' v-if='studentData.length > 0'>設定欄位對應</div>
            <v-alert type="info" icon="fa-info" v-if='studentData.length > 0'>特別提醒：你應該要確保學生名單中沒有重複的人</v-alert>
            <v-select
              v-if='studentData.length > 0'
              :items="studentHeaders"
              v-model="uniqField"
              outlined
              label="唯一值欄位"
              hint="唯一值，可能是身分證"
            ></v-select>
            <v-select
              v-if='studentData.length > 0'
              :items="studentHeaders"
              v-model="groupingField"
              outlined
              label="分組欄位"
              hint="分組欄位，可能是性別，啟動分組之後，系統會針對分組個別跑S型分班"
            ></v-select>
            <v-select
              v-if='studentData.length > 0'
              :items="studentHeaders"
              v-model="scoreField"
              outlined
              label="分數欄位"
              hint="分數，任何一種你要拿來跑S型的分數"
            ></v-select>
          </v-card-text>
        </v-card>
      </v-dialog>
      <v-row>
        <v-col class='d-flex blue darken-4 justify-space-between flex-column align-content-space-between'>
          <div class='text-caption white--text ma-1 text-left'>學生總數</div>
          <div class='text-h4 white--text ma-1 text-center'>{{ students.length }}</div>
          <v-btn @click="studentDataW = true" class='red darken-4 white--text ma-1'>{{ students.length > 0 ? '重建' : '讀入' }}學生清單</v-btn>
        </v-col>
        <v-col class='d-flex blue darken-4 justify-space-between flex-column align-content-space-between'>
          <div class='text-caption white--text ma-1 text-left'>分組</div>
          <div class='text-h4 white--text text-center'>{{ enableGrouping ? '啟動' : '關閉' }}</div>
          <v-btn @click="enableGrouping = !enableGrouping" class='red darken-4 white--text ma-1'>{{ enableGrouping ? '關閉分組' : '啟動分組' }}</v-btn>
          <v-btn @click="reverseGrouping = !reverseGrouping"  v-if="enableGrouping" class='red darken-4 white--text ma-1'>{{ reverseGrouping ? '首尾班交替S型' : '都從第一班開始' }}</v-btn>
        </v-col>
        <v-col class='d-flex blue darken-4 justify-space-between flex-column align-content-space-between'>
          <div class='text-caption white--text ma-1 text-left'>班級數</div>
          <div class='text-h4 white--text ma-1 text-center'>{{ classesCount }}</div>
          <v-slider
            v-model="classesCount"
            hint="預設值為1"
            thumb-label
            max="20"
            min="1"
          ></v-slider>
        </v-col>
        <v-col class='blue darken-4 justify-space-between flex-column d-flex align-content-space-between'>
          <v-btn class="ma-1 red darken-4 white--text" @click="studentDetail" :disabled="students.length === 0">啟動排序</v-btn>
          <v-btn class="ma-1 red darken-4 white--text" @click="sortStudents" :disabled="groups.length === 0">啟動編班</v-btn>
          <v-btn class="ma-1 red darken-4 white--text" @click="randomAssignment" :disabled="classes.length === 0">隨機打入（{{ unSorted }}）</v-btn>
          <v-btn class="ma-1 red darken-4 white--text" @click="downloadCSV(students, '編班結果')" :disabled="unAssignment > 0">導出清單</v-btn>
        </v-col>
      </v-row>
      <v-row>
        <v-col class="d-flex flex-column pt-0">
          <v-alert type="info" icon="fa-info" v-if="sortMsg !== ''">{{ sortMsg }}</v-alert>
          <v-alert type="error" icon="fa-triangle-exclamation" v-if="groups.length > 10">請注意，你的分組大於10的時候，用了區分分組的底色色盤會不夠用喔（不影響計算）</v-alert>
          <v-alert type="error" icon="fa-info" v-show="classes.length > 0" v-if='unAssignment > 0'>
            目前還有 {{ unAssignment }} 人尚未分配完成
          </v-alert>
          <v-tabs
            v-model="currentTab"
            align-with-title
          >
            <v-tabs-slider color="yellow"></v-tabs-slider>
            <v-tab v-if="groups.length > 0" class="black--text">分組狀況</v-tab>
            <v-tab v-if="classes.length > 0" class="black--text">編班結果</v-tab>
          </v-tabs>
          <v-tabs-items v-model="currentTab">
            <v-tab-item>
              <v-card flat>
                <v-card-text class="d-flex flex-column">
                  <v-alert type="info" icon="fa-info" v-if="classes.length > 0">總平均{{ (totalAvg).toFixed(2) }}分</v-alert>
                  <div v-for="group in groups" :key="group.id" class="d-flex flex-column">
                    <div class="d-flex flex-row align-center blue-grey lighten-4 pa-1">
                      <div class="text-h6 mr-1">{{ group.name }}</div>
                      <div>| 共{{ group.students.length }}人</div>
                      <div>| 平均{{ avg(group.students) }}分</div>
                    </div>
                    <div class="d-flex flex-column flex-wrap" style="height: 30em">
                      <div v-for="student in group.students" :key="'g'+student.id" class="white--text ma-1 pa-1 text-center gradeBlock" :class="colors[student.grouping]">
                        {{ student.score }}
                      </div>
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </v-tab-item>
            <v-tab-item>
              <v-card flat>
                <v-card-text class="d-flex flex-column">
                  <v-alert type="info" icon="fa-info" v-if="classes.length > 0">{{ classDetail }}</v-alert>
                  <div v-for="c in classes" :key="c.id" class="d-flex flex-column">
                    <div class="d-flex flex-row align-center blue-grey lighten-4 pa-1">
                      <div class="text-h6 mr-1">{{ c.name }}</div>
                      <div>| 共{{ c.students.length }}人<span v-if="c.students.length > 10" class="red--text text-caption">不會顯示第11人之後的結果</span></div>
                      <div>| 平均{{ avg(c.students) }}分</div>
                      <div>| 和總平均誤差{{ diff(c.students) }}</div>
                      <div v-if="enableGrouping">
                        {{ groupAvg(c.students) }}
                      </div>
                    </div>
                    <div class="d-flex flex-column flex-wrap" style="height: 4em">
                      <div v-for="student in c.students.slice(0, 10)" :key="'c'+student.id" class="white--text ma-1 pa-1 text-center gradeBlock" :class="colors[student.grouping]">
                        {{ student.score }}
                      </div>
                    </div>
                  </div>
                </v-card-text>
              </v-card>
            </v-tab-item>
          </v-tabs-items>
          <div class="text-caption text-center" ><span class="grey--text">Kelunyang @ LKSH 2023</span></div>
        </v-col>
      </v-row>
    </v-main>
  </v-app>
</template>

<style>
div.gradeBlock {
  height: 2em;
  min-width: 2em;
  font-size: 1.5em;
}
</style>

<script>
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import Papa from 'papaparse';
import '@fortawesome/fontawesome-free/css/all.css';
import '@fortawesome/fontawesome-free/js/all.js';
import iconv from 'iconv-lite';
import chardet from 'chardet';

export default {
  name: 'App',
  computed: {
    totalAvg: function() {
      return _.meanBy(this.students, (student) => {
        return student.score;
      })
    },
    classDetail: function() {
      if(this.classes.length > 0) {
        let avgs = [];
        for(let i=0; i<this.classes.length; i++) {
          let avg = _.meanBy(_.map(this.classes[i].students), (student) => {
            return student.score;
          });
          avgs.push(avg);
        }
        let max = _.max(avgs);
        let min = _.min(avgs);
        let maxDiff = Math.abs(max-this.totalAvg);
        let minDiff = Math.abs(this.totalAvg-min);
        let maxPer = ((maxDiff / this.totalAvg) * 100).toFixed(2);
        let minPer = ((minDiff / this.totalAvg) * 100).toFixed(2);
        return "平均最高班級和總平均的誤差是" + (maxDiff).toFixed(2) + "(" + maxPer + "%)／平均最低班級和總平均的誤差是" + (minDiff).toFixed(2) + "(" + minPer + "%)";
      }
      return "";
    },
    unAssignment: function() {
      if(this.classes.length > 0) {
        let unAssignment = _.filter(this.students, (student) => {
          return student.status === "未設定";
        });
        return unAssignment.length;
      } else {
        return 1;
      }
    },
    unSorted: function() {
      let unSorted = _.filter(this.students, (student) => {
        return student.status != "分配完成";
      });
      return unSorted.length === 0 ? "無" : unSorted.length;
    }
  },
  watch: {
    studentFile: {
      immediate: true,
      async handler () {
        let oriobj = this;
        if (this.studentFile !== undefined) {
          let reader = new FileReader();
          reader.readAsArrayBuffer(oriobj.studentFile);
          reader.onload = ((file) => {
            try {
              let result = Buffer.from(file.target.result);
              let encoding = chardet.detect(result);
              let content = iconv.decode(Buffer.from(file.target.result), encoding);
              oriobj.studentError = '';
              Papa.parse(content, {
                header: false,
                skipEmptyLines: true,
                complete: async function(result) {
                  if(result.data.length > 0) {
                    let headers = result.data[0];
                    oriobj.studentHeaders = [];
                    for(let i=0; i<headers.length; i++) {
                      oriobj.studentHeaders.push({
                        text: headers[i],
                        value: i
                      });
                    }
                  }
                }
              });
              Papa.parse(content, {
                header: true,
                skipEmptyLines: true,
                complete: async function(result) {
                  if(result.data.length > 0) {
                    oriobj.studentData = result.data;
                  }
                }
              });
            } catch(e) {
              console.dir(e);
            }
          });
        }
      }
    },
  },
  mounted: function() {
    let oriobj = this;
    window.ipcRenderer.receive('sortMsg', (args) => {
      oriobj.sortMsg = "正在分配的分組：" + args.name
      if(!args.random) {
        oriobj.sortMsg = "／反向排序：" + args.reverse ? "是" : "否" + "／第" + args.times + "次分配"
      }
    });
    window.ipcRenderer.receive('startSort', (args) => {
      oriobj.sortMsg = "開始分配！學生共" + args.student + "人／分組共" + args.group + "組／班級共" + args.class + "班／" + args.random ? "隨機分配" : "S型分配";
    });
    window.ipcRenderer.receive('startDetail', (args) => {
      oriobj.sortMsg = args;
    });
    window.ipcRenderer.receive('endDetail', (args) => {
      oriobj.groups = args;
    });
    window.ipcRenderer.receive('endSort', (args) => {
      oriobj.groups = args.groups;
      oriobj.students = args.students;
      oriobj.classes = args.classes;
      oriobj.sortMsg = "";
      for(let i=0; i<oriobj.classes.length; i++) {
        let correctArr = [];
        for(let k=0; k<oriobj.classes[i].students.length; k++) {
          let std = _.filter(oriobj.students, (std) => {
            return std.id === oriobj.classes[i].students[k].id;
          });
          correctArr.push(std[0]);
        }
        oriobj.classes[i].students = correctArr;
      }
      for(let i=0; i<oriobj.groups.length; i++) {
        let correctArr = [];
        for(let k=0; k<oriobj.groups[i].students.length; k++) {
          let std = _.filter(oriobj.students, (std) => {
            return std.id === oriobj.groups[i].students[k].id;
          });
          correctArr.push(std[0]);
        }
        oriobj.groups[i].students = correctArr;
      }
      oriobj.currentTab = 1;
    });
  },
  methods: {
    diff: function(students) {
      let avg = _.meanBy(students, (student) => {
        return student.score;
      });
      let diff = avg - this.totalAvg;
      let per = ((Math.abs(diff) / avg) * 100).toFixed(2);
      return diff.toFixed(2) + "分(" + per + "%)";
    },
    studentDetail: function() {
      window.ipcRenderer.send("studentDetail", {
        enableGrouping: this.enableGrouping,
        students: this.students
      });
    },
    sortStudents: function() {
      window.ipcRenderer.send("sortStudents", {
        students: this.students,
        classCount: this.classesCount,
        groups: this.groups,
        reverse: this.reverseGrouping
      });
    },
    randomAssignment: function() {
      window.ipcRenderer.send("randomAssignment", {
        students: this.students,
        classes: this.classes,
        groups: this.groups
      });
    },
    groupAvg: function(students) {
      let groups = _.uniq(_.map(students, 'grouping'));
      let returnText = "";
      for(let i=0; i<groups.length; i++) {
        let gStd = _.filter(students, (std) => {
          return std.grouping === groups[i];
        });
        returnText += "| " + groups[i] + "平均" + (_.meanBy(gStd, (std) => {
          return std.score
        })).toFixed(2); + "分|";
      }
      return returnText;
    },
    avg: function(students) {
      return (_.meanBy(students, (std) => {
        return std.score;
      })).toFixed(2);
    },
    buildstudentList: function() {
      this.students = [];
      this.groups = [];
      for(let i=0; i<this.studentData.length; i++) {
        this.students.push({
          uniq: this.studentData[i][this.studentHeaders[this.uniqField].text],
          score: parseFloat(this.studentData[i][this.studentHeaders[this.scoreField].text]),
          grouping: this.studentData[i][this.studentHeaders[this.groupingField].text],
          class: "",
          status: "未設定",
          id: uuidv4()
        });
      }
      this.currentTab = 1;
      this.classesCount = 1;
      this.uniqField = 0;
      this.groupingField = 0;
      this.scoreField = 0;
      this.reverseGrouping = true;
      this.classes = [];
      this.students = _.uniqBy(this.students, (student) => {
        return student.uniq;
      });
      let groups = _.uniq(_.map(this.students, 'grouping'));
      let colors = _.shuffle(this.colorPattle);
      for(let i=0; i<groups.length; i++) {
        this.colors[groups[i]] = colors[i % 10];
      }
      this.studentDataW = false;
    },
    downloadCSV: function(arr, filename) {
      let output = "\ufeff"+ Papa.unparse(arr);
      let element = document.createElement('a');
      let blob = new Blob([output], { type: 'text/csv' });
      let url = window.URL.createObjectURL(blob);
      element.setAttribute('href', url);
      element.setAttribute('download', filename + ".csv");
      element.click();
    },
  },
  data: () => ({
    reverseGrouping: true,
    currentTab: 0,
    colorPattle: ["deep-orange darken-4", "red darken-2", "purple darken-2", "indigo darken-2", "blue darken-2", "light-blue darken-2", "cyan darken-2", "teal darken-2", "brown darken-2", "blue-grey darken-2"],
    colors: [],
    sortMsg: "",
    classesCount: 1,
    groups: [],
    classes: [],
    enableGrouping: false,
    students: [],
    studentDataW: false,
    studentData: [],
    studentError: "",
    studentFile: undefined,
    studentHeaders: [],
    uniqField: 0,
    groupingField: 0,
    scoreField: 0,
    sampleStudents: [
      {
        "姓名": "天竺鼠車車",
        "分組": "女",
        "成績": 30
      },
      {
        "姓名": "諸葛村夫",
        "分組": "男",
        "成績": 30
      }
    ]
  }),
};
</script>
