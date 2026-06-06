import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAMNDoNuqkWfXEGYdwueJb5XTr1ST2ztKc",
  authDomain: "mcqs-96117.firebaseapp.com",
  projectId: "mcqs-96117",
  storageBucket: "mcqs-96117.firebasestorage.app",
  messagingSenderId: "352256319143",
  appId: "1:352256319143:web:74b2bd062a7f2dc5f1c582",
  measurementId: "G-6FZ770H045"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

const urlParams = new URLSearchParams(window.location.search);
const subject = urlParams.get('subject') || 'Anatomy';

let questions = [];
let current = 0;
let selectedAnswers = [];
let startTime = Date.now();
let timerInterval;

const qText = document.getElementById("question-text");
const qImage = document.getElementById("question-image");
const qOptions = document.getElementById("options");
const qNumber = document.getElementById("question-number");
const palette = document.getElementById("palette");
const resultDiv = document.getElementById("result-summary");
const timer = document.getElementById("timer");

const expBox = document.getElementById("explanation-box");
const expTitle = document.getElementById("explanation-title");
const expText = document.getElementById("explanation-text");
const expImage = document.getElementById("explanation-image");

document.addEventListener('contextmenu', function(event) {
  event.preventDefault();
  alert('Right-click is disabled on this page!');
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    loadProgress(user.uid);
    loadQuiz(subject, user.uid);
  } else {
    loadQuiz(subject);
  }
});

function renderPalette() {
  palette.innerHTML = "";
  questions.forEach((_, i) => {
    const btn = document.createElement("button");
    btn.textContent = i + 1;
    btn.onclick = () => loadQuestion(i);

    if (selectedAnswers[i] !== undefined) {
      btn.style.background = selectedAnswers[i].correct ? "#66bb6a" : "#ef5350";
    }

    palette.appendChild(btn);
  });
}

function loadQuestion(index) {

  current = index;
  const q = questions[index];

  qNumber.textContent = `Question ${index + 1}`;
  qText.textContent = q.question;

  qImage.style.display = q.image ? "block" : "none";
  qImage.src = q.image || "";

  qOptions.innerHTML = "";

  expBox.style.display = "none";
  expTitle.style.display = "none";
  expText.innerHTML = "";
  expImage.style.display = "none";

  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.onclick = () => selectAnswer(i);
    qOptions.appendChild(btn);
  });

  if (selectedAnswers[index] !== undefined) {

    const correctIndex = q.answer;
    const selected = selectedAnswers[index].selectedIndex;

    const buttons = qOptions.querySelectorAll("button");

    buttons.forEach((b, i) => {

      b.disabled = true;

      if (i === correctIndex) b.classList.add("correct");

      if (i === selected && selected !== correctIndex) b.classList.add("wrong");

    });

    showExplanation(q);
  }

  renderPalette();
}

function selectAnswer(selectedIndex) {

  const q = questions[current];

  const isCorrect = selectedIndex === q.answer;

  selectedAnswers[current] = { selectedIndex, correct: isCorrect };

  const buttons = qOptions.querySelectorAll("button");

  buttons.forEach((b, i) => {

    b.disabled = true;

    if (i === q.answer) b.classList.add("correct");

    if (i === selectedIndex && !isCorrect) b.classList.add("wrong");

  });

  showExplanation(q);

  saveProgress(auth.currentUser ? auth.currentUser.uid : null);

  renderPalette();
}

function showExplanation(q){

  expBox.style.display = "block";
  expTitle.style.display = "block";

  expText.innerHTML = q.explanation ? q.explanation : "No explanation available.";

  if(q.explanation_image && q.explanation_image !== ""){
      expImage.src = q.explanation_image;
      expImage.style.display = "block";
  }else{
      expImage.style.display = "none";
  }

}

function prevQuestion(){
  if(current>0) loadQuestion(current-1);
}

function nextQuestion(){
  if(current<questions.length-1) loadQuestion(current+1);
}

function resetQuiz(){
  selectedAnswers=[];
  saveProgress(auth.currentUser ? auth.currentUser.uid : null);
  loadQuestion(0);
  resultDiv.innerHTML="";
  startTime=Date.now();
}

function submitQuiz(){

  let correct=0,wrong=0,attempted=0;

  selectedAnswers.forEach(a=>{
    if(a!==undefined){
      attempted++;
      if(a.correct) correct++;
      else wrong++;
    }
  });

  const unattempted=questions.length-attempted;
  const score=correct*4-wrong;

  const timeTaken=Math.floor((Date.now()-startTime)/1000);

  const minutes=Math.floor(timeTaken/60);
  const seconds=timeTaken%60;

  resultDiv.innerHTML=`
    <h3>Quiz Summary</h3>
    <p>✅ Correct: ${correct}</p>
    <p>❌ Wrong: ${wrong}</p>
    <p>⏳ Unattempted: ${unattempted}</p>
    <p>🧮 Score: ${score} / ${questions.length * 4}</p>
    <p>⏱️ Time Taken: ${minutes} min ${seconds} sec</p>
    <canvas id="resultChart" width="300" height="300"></canvas>
  `;

  new Chart(document.getElementById("resultChart"),{
    type:"pie",
    data:{
      labels:["Correct","Wrong","Unattempted"],
      datasets:[{
        data:[correct,wrong,unattempted],
        backgroundColor:["#66bb6a","#ef5350","#ffee58"]
      }]
    }
  });

  clearInterval(timerInterval);
  renderPalette();
}

function updateTimer(){

  const diff=Math.floor((Date.now()-startTime)/1000);
  const mins=Math.floor(diff/60);
  const secs=diff%60;

  timer.textContent=`Time: ${mins}m ${secs}s`;
}

async function saveProgress(userId){

  if(!userId) return;

  const key=`progress_${subject}`;

  const summary={
    attempted:selectedAnswers.filter(a=>a!==undefined).length,
    correct:selectedAnswers.filter(a=>a && a.correct).length,
    wrong:selectedAnswers.filter(a=>a && !a.correct).length,
    total:questions.length,
    answers:selectedAnswers.filter(a=>a!==undefined),
    timestamp:new Date().toISOString()
  };

  const userProgressRef=doc(db,"user_progress",userId);

  await setDoc(userProgressRef,{[key]:summary});
}

async function loadProgress(userId){

  if(!userId) return;

  const key=`progress_${subject}`;

  const userProgressRef=doc(db,"user_progress",userId);

  const userProgressSnap=await getDoc(userProgressRef);

  if(userProgressSnap.exists()){

    const userProgress=userProgressSnap.data();
    const savedProgress=userProgress[key];

    if(savedProgress){
      selectedAnswers=savedProgress.answers || [];
    }

  }

}

async function loadQuiz(subjectName,userId=null){

  const docRef=doc(db,"questions",subjectName);
  const docSnap=await getDoc(docRef);

  if(docSnap.exists()){

    questions=docSnap.data().questions;
    selectedAnswers=new Array(questions.length);

    if(userId) loadProgress(userId);

    loadQuestion(0);
    timerInterval=setInterval(updateTimer,1000);

  }else{

    alert("No questions found for this subject.");

  }

}

window.prevQuestion=prevQuestion;
window.nextQuestion=nextQuestion;
window.resetQuiz=resetQuiz;
window.submitQuiz=submitQuiz;
