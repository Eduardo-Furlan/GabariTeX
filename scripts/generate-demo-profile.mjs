import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';

function sha256Hex(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

// 1. Carregar imagem do gráfico da parábola
const imgPath = path.resolve('docs/screenshots/assets/diagrama-geometria.png');
const imgBytes = fs.readFileSync(imgPath);
const imgFullHash = sha256Hex(imgBytes);
const imgShortHash = imgFullHash.slice(0, 16);
const assetRelPath = `assets/${imgShortHash}.png`;

// 2. Definir a prova oficial Escola Exemplo
const exam = {
  id: 'exam-escola-exemplo-mat',
  header: {
    institution: 'Escola Exemplo',
    course: 'Matemática Aplicada',
    professor: 'Prof. Carlos Mendes',
    examTitle: 'Avaliação Bimestral',
    date: '20/10/2026',
    instructions: 'Preencha o cartão com caneta azul ou preta. Não rasure as bolinhas nem dobre a folha.',
    targetScore: 10,
  },
  password: 'EXEMPLO1',
  versionCount: 2,
  shuffleQuestions: true,
  shuffleOptions: true,
  twoColumns: false,
  updatedAt: '2026-10-17T12:00:00.000Z',
  questions: [
    {
      id: 'q1',
      type: 'objective',
      points: 1.0,
      prompt: 'Qual dos seguintes números é um número primo?',
      options: [
        { id: 'q1_a', label: 'A', text: '17', isCorrect: true },
        { id: 'q1_b', label: 'B', text: '21', isCorrect: false },
        { id: 'q1_c', label: 'C', text: '27', isCorrect: false },
        { id: 'q1_d', label: 'D', text: '35', isCorrect: false },
      ],
    },
    {
      id: 'q2',
      type: 'objective',
      points: 1.5,
      prompt: 'Considere a equação quadrática $f(x) = x^2 - 4x + 3$. Quais são as raízes reais dessa função?',
      options: [
        { id: 'q2_a', label: 'A', text: '$x = -1$ e $x = -3$', isCorrect: false },
        { id: 'q2_b', label: 'B', text: '$x = 1$ e $x = 3$', isCorrect: true },
        { id: 'q2_c', label: 'C', text: '$x = 2$ e $x = 4$', isCorrect: false },
        { id: 'q2_d', label: 'D', text: '$x = 0$ e $x = 3$', isCorrect: false },
      ],
    },
    {
      id: 'q3',
      type: 'objective',
      points: 1.5,
      prompt: 'A figura abaixo ilustra o gráfico de uma trajetória parabólica em um sistema cartesiano de coordenadas.',
      imageUrl: `asset:${imgShortHash}.png`,
      imageCaption: 'Figura 1: Esboço da curva parabólica no plano cartesiano',
      options: [
        { id: 'q3_a', label: 'A', text: 'O coeficiente principal é positivo', isCorrect: false },
        { id: 'q3_b', label: 'B', text: 'A função não possui raízes reais', isCorrect: false },
        { id: 'q3_c', label: 'C', text: 'O vértice da parábola representa um ponto de máximo local', isCorrect: true },
        { id: 'q3_d', label: 'D', text: 'O eixo de simetria coincide com o eixo vertical', isCorrect: false },
      ],
    },
    {
      id: 'q4',
      type: 'objective',
      points: 1.5,
      prompt: 'Em um triângulo retângulo, a hipotenusa mede $10\\text{ cm}$ e um dos catetos mede $6\\text{ cm}$. O valor do outro cateto é:',
      options: [
        { id: 'q4_a', label: 'A', text: '$4\\text{ cm}$', isCorrect: false },
        { id: 'q4_b', label: 'B', text: '$5\\text{ cm}$', isCorrect: false },
        { id: 'q4_c', label: 'C', text: '$7\\text{ cm}$', isCorrect: false },
        { id: 'q4_d', label: 'D', text: '$8\\text{ cm}$', isCorrect: true },
        { id: 'q4_e', label: 'E', text: '$9\\text{ cm}$', isCorrect: false },
      ],
    },
    {
      id: 'q5',
      type: 'subjective',
      points: 2.5,
      prompt: 'Demonstre passo a passo o cálculo das coordenadas do vértice $(x_v, y_v)$ da função quadrática $f(x) = -x^2 + 6x - 5$.',
      linesForAnswer: 8,
    },
    {
      id: 'q6',
      type: 'objective',
      points: 2.0,
      prompt: 'Calcule a integral definida $\\int_{0}^{2} (3x^2 + 1)\\,dx$ e selecione o resultado correto:',
      options: [
        { id: 'q6_a', label: 'A', text: '$10$', isCorrect: true },
        { id: 'q6_b', label: 'B', text: '$12$', isCorrect: false },
        { id: 'q6_c', label: 'C', text: '$14$', isCorrect: false },
        { id: 'q6_d', label: 'D', text: '$8$', isCorrect: false },
      ],
    },
  ],
};

// 3. Definir a turma e estudantes
const classroom = {
  id: 'class-escola-exemplo-3a',
  name: 'Turma 3º Ano A',
  createdAt: '2026-10-17T12:00:00.000Z',
  updatedAt: '2026-10-17T12:00:00.000Z',
  students: [
    { id: 'std-202601', name: 'Ana Beatriz Silva', registration: '202601' },
    { id: 'std-202602', name: 'Bruno Carvalho Lima', registration: '202602' },
    { id: 'std-202603', name: 'Camila Duarte Santos', registration: '202603' },
    { id: 'std-202604', name: 'Daniel Ferreira Rocha', registration: '202604' },
    { id: 'std-202605', name: 'Elena Martins Ramos', registration: '202605' },
    { id: 'std-202606', name: 'Felipe Augusto Souza', registration: '202606' },
    { id: 'std-202607', name: 'Gabriela Costa Ribeiro', registration: '202607' },
    { id: 'std-202608', name: 'Henrique Dias Moreira', registration: '202608' },
  ],
};

// 4. Definir registros de correção para o livro de notas (Gradebook)
const studentsData = [
  { ref: 'std-202601', name: 'Ana Beatriz Silva', reg: '202601', v: 'A', q1: 'A', q2: 'B', q3: 'C', q4: 'D', q6: 'A', q5pts: 2.5 },
  { ref: 'std-202602', name: 'Bruno Carvalho Lima', reg: '202602', v: 'A', q1: 'A', q2: 'B', q3: 'C', q4: 'D', q6: 'B', q5pts: 2.0 },
  { ref: 'std-202603', name: 'Camila Duarte Santos', reg: '202603', v: 'A', q1: 'A', q2: 'B', q3: 'A', q4: 'D', q6: 'A', q5pts: 2.0 },
  { ref: 'std-202604', name: 'Daniel Ferreira Rocha', reg: '202604', v: 'B', q1: 'A', q2: 'C', q3: 'C', q4: 'D', q6: 'A', q5pts: 1.5 },
  { ref: 'std-202605', name: 'Elena Martins Ramos', reg: '202605', v: 'A', q1: 'A', q2: 'B', q3: 'C', q4: 'D', q6: 'A', q5pts: 2.5 },
  { ref: 'std-202606', name: 'Felipe Augusto Souza', reg: '202606', v: 'A', q1: 'B', q2: 'B', q3: 'C', q4: 'A', q6: 'A', q5pts: 1.0 },
  { ref: 'std-202607', name: 'Gabriela Costa Ribeiro', reg: '202607', v: 'A', q1: 'A', q2: 'B', q3: 'C', q4: 'D', q6: 'A', q5pts: 2.0 },
  { ref: 'std-202608', name: 'Henrique Dias Moreira', reg: '202608', v: 'A', q1: 'A', q2: 'B', q3: 'C', q4: 'D', q6: 'D', q5pts: 1.5 },
];

const officialKeys = {
  q1: { correct: 'A', maxPts: 1.0 },
  q2: { correct: 'B', maxPts: 1.5 },
  q3: { correct: 'C', maxPts: 1.5 },
  q4: { correct: 'D', maxPts: 1.5 },
  q6: { correct: 'A', maxPts: 2.0 },
};

const records = studentsData.map((std, idx) => {
  const answers = [
    {
      questionNumber: 1,
      markedOption: std.q1,
      correctOption: officialKeys.q1.correct,
      isCorrect: std.q1 === officialKeys.q1.correct,
      status: std.q1 === officialKeys.q1.correct ? 'correct' : 'wrong',
      pointsEarned: std.q1 === officialKeys.q1.correct ? officialKeys.q1.maxPts : 0,
      maxPoints: officialKeys.q1.maxPts,
    },
    {
      questionNumber: 2,
      markedOption: std.q2,
      correctOption: officialKeys.q2.correct,
      isCorrect: std.q2 === officialKeys.q2.correct,
      status: std.q2 === officialKeys.q2.correct ? 'correct' : 'wrong',
      pointsEarned: std.q2 === officialKeys.q2.correct ? officialKeys.q2.maxPts : 0,
      maxPoints: officialKeys.q2.maxPts,
    },
    {
      questionNumber: 3,
      markedOption: std.q3,
      correctOption: officialKeys.q3.correct,
      isCorrect: std.q3 === officialKeys.q3.correct,
      status: std.q3 === officialKeys.q3.correct ? 'correct' : 'wrong',
      pointsEarned: std.q3 === officialKeys.q3.correct ? officialKeys.q3.maxPts : 0,
      maxPoints: officialKeys.q3.maxPts,
    },
    {
      questionNumber: 4,
      markedOption: std.q4,
      correctOption: officialKeys.q4.correct,
      isCorrect: std.q4 === officialKeys.q4.correct,
      status: std.q4 === officialKeys.q4.correct ? 'correct' : 'wrong',
      pointsEarned: std.q4 === officialKeys.q4.correct ? officialKeys.q4.maxPts : 0,
      maxPoints: officialKeys.q4.maxPts,
    },
    {
      questionNumber: 6,
      markedOption: std.q6,
      correctOption: officialKeys.q6.correct,
      isCorrect: std.q6 === officialKeys.q6.correct,
      status: std.q6 === officialKeys.q6.correct ? 'correct' : 'wrong',
      pointsEarned: std.q6 === officialKeys.q6.correct ? officialKeys.q6.maxPts : 0,
      maxPoints: officialKeys.q6.maxPts,
    },
  ];

  const subjectiveAnswers = [
    {
      questionNumber: 5,
      maxPoints: 2.5,
      pointsEarned: std.q5pts,
    },
  ];

  const objTotal = answers.reduce((acc, a) => acc + a.pointsEarned, 0);
  const subjTotal = subjectiveAnswers.reduce((acc, s) => acc + (s.pointsEarned || 0), 0);
  const totalScore = Math.round((objTotal + subjTotal) * 100) / 100;
  const maxScore = 10.0;
  const percentage = Math.round((totalScore / maxScore) * 1000) / 10;

  return {
    id: `rec-demo-${idx + 1}`,
    timestamp: Date.now() - (8 - idx) * 3600000,
    studentName: std.name,
    studentId: std.reg,
    studentRef: std.ref,
    classId: classroom.id,
    examId: exam.id,
    examFingerprint: 'ccd41656',
    versionLetter: std.v,
    totalScore,
    maxScore,
    percentage,
    answers,
    subjectiveAnswers,
  };
});

// 5. Configurar Profile Payload
const profilePayload = {
  exams: [exam],
  classes: [classroom],
  records,
  settings: {
    activeExamId: exam.id,
    activeClassId: classroom.id,
  },
};

const profileJsonStr = JSON.stringify(profilePayload, null, 2);
const profileJsonBytes = strToU8(profileJsonStr);
const profileHash = sha256Hex(profileJsonBytes);

const fileHashes = {
  'profile.json': profileHash,
  [assetRelPath]: imgFullHash,
};

const manifest = {
  app: 'gabaritex',
  kind: 'profile',
  schema: 1,
  exportedAt: new Date().toISOString(),
  counts: {
    exams: 1,
    classes: 1,
    records: records.length,
    assets: 1,
  },
  includes: {
    records: true,
    classes: true,
    passwords: true,
  },
  files: fileHashes,
};

const manifestJsonStr = JSON.stringify(manifest, null, 2);
const manifestJsonBytes = strToU8(manifestJsonStr);

const zipEntries = {
  'manifest.json': manifestJsonBytes,
  'profile.json': profileJsonBytes,
  [assetRelPath]: [new Uint8Array(imgBytes), { level: 0 }],
};

const zipUint8 = zipSync(zipEntries);
const outputPath = path.resolve('docs/screenshots/assets/escola-exemplo-perfil.zip');
fs.writeFileSync(outputPath, zipUint8);

console.log(`Perfil demo gerado com sucesso em: ${outputPath}`);
console.log(`Tamanho do arquivo: ${zipUint8.byteLength} bytes`);
