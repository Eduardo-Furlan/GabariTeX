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

// 4. Funções determinísticas para gerar os layouts das versões embaralhadas
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray(array, prng) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E'];

function buildVersionLayouts(examDef) {
  const layouts = [];
  const versionLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let v = 0; v < examDef.versionCount; v++) {
    const versionLetter = versionLetters[v] || `V${v + 1}`;
    const seed = (v + 1) * 123456789 + examDef.questions.length;
    const prng = mulberry32(seed);

    let processedQuestions = examDef.questions.map((q) => ({
      ...q,
      options: q.options ? q.options.map((opt) => ({ ...opt })) : undefined,
    }));

    if (examDef.shuffleQuestions) {
      processedQuestions = shuffleArray(processedQuestions, prng);
    }

    const answerKey = {};

    processedQuestions = processedQuestions.map((q, idx) => {
      const qNum = idx + 1;
      if (q.type === 'objective' && q.options && q.options.length > 0) {
        let options = [...q.options];
        if (examDef.shuffleOptions) {
          options = shuffleArray(options, prng);
        }

        options = options.map((opt, optIdx) => ({
          ...opt,
          label: OPTION_LABELS[optIdx] || 'A',
        }));

        const correctOpt = options.find((opt) => opt.isCorrect);
        if (correctOpt) {
          answerKey[qNum] = correctOpt.label;
        }

        return { ...q, options };
      }
      return q;
    });

    layouts.push({
      versionLetter,
      seed,
      questions: processedQuestions,
      objectiveAnswerKey: answerKey,
    });
  }

  return layouts;
}

const layouts = buildVersionLayouts(exam);

// 5. Definir respostas dos estudantes (referenciando as opções da prova original)
const studentsData = [
  { ref: 'std-202601', name: 'Ana Beatriz Silva', reg: '202601', v: 'A', q1: 'A', q2: 'B', q3: 'C', q4: 'D', q6: 'A', q5pts: 2.5 },
  { ref: 'std-202602', name: 'Bruno Carvalho Lima', reg: '202602', v: 'A', q1: 'A', q2: 'B', q3: 'C', q4: 'D', q6: 'B', q5pts: 2.0 },
  { ref: 'std-202603', name: 'Camila Duarte Santos', reg: '202603', v: 'A', q1: 'A', q2: 'B', q3: 'A', q4: 'D', q6: 'A', q5pts: 2.0 },
  { ref: 'std-202604', name: 'Daniel Ferreira Rocha', reg: '202604', v: 'B', q1: 'A', q2: 'C', q3: 'C', q4: 'D', q6: 'A', q5pts: 1.5 },
  { ref: 'std-202605', name: 'Elena Martins Ramos', reg: '202605', v: 'A', q1: 'A', q2: 'B', q3: 'C', q4: 'D', q6: 'A', q5pts: 2.5 },
  { ref: 'std-202606', name: 'Felipe Augusto Souza', reg: '202606', v: 'A', q1: 'A', q2: 'B', q3: 'C', q4: 'A', q6: 'A', q5pts: 0.0 },
  { ref: 'std-202607', name: 'Gabriela Costa Ribeiro', reg: '202607', v: 'A', q1: 'A', q2: 'B', q3: 'C', q4: 'D', q6: 'A', q5pts: 2.0 },
  { ref: 'std-202608', name: 'Henrique Dias Moreira', reg: '202608', v: 'A', q1: 'A', q2: 'B', q3: 'C', q4: 'D', q6: 'D', q5pts: 1.5 },
];

const records = studentsData.map((std, idx) => {
  const layout = layouts.find((l) => l.versionLetter === std.v);
  const answers = [];
  const subjectiveAnswers = [];

  layout.questions.forEach((lq, lIdx) => {
    const qNum = lIdx + 1;
    const origQ = exam.questions.find((q) => q.id === lq.id);

    if (lq.type === 'objective') {
      const chosenLabel = std[origQ.id];
      const origOpt = origQ.options.find((o) => o.label === chosenLabel);
      const sheetOpt = lq.options.find((o) => o.id === origOpt.id);
      const markedOption = sheetOpt.label;
      const correctOption = layout.objectiveAnswerKey[qNum];
      const isCorrect = markedOption === correctOption;
      const pointsEarned = isCorrect ? lq.points : 0;

      answers.push({
        questionNumber: qNum,
        markedOption,
        correctOption,
        isCorrect,
        status: isCorrect ? 'correct' : 'wrong',
        pointsEarned,
        maxPoints: lq.points,
      });
    } else if (lq.type === 'subjective') {
      subjectiveAnswers.push({
        questionNumber: qNum,
        pointsEarned: std.q5pts,
        maxPoints: lq.points,
      });
    }
  });

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

// 5. Configurar Banco de Questões Demonstrativo
const demoBankGroups = [
  {
    id: 'grp-mat',
    parentId: null,
    name: 'Matemática',
    order: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'grp-alg',
    parentId: 'grp-mat',
    name: 'Álgebra',
    order: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'grp-geo',
    parentId: 'grp-mat',
    name: 'Geometria',
    order: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'grp-calc',
    parentId: 'grp-mat',
    name: 'Cálculo',
    order: 2,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
];

const demoBankTags = [
  {
    id: 'tag-facil',
    name: 'Fácil',
    color: 'green',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'tag-media',
    name: 'Média',
    color: 'amber',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'tag-dificil',
    name: 'Difícil',
    color: 'red',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'tag-enem',
    name: 'ENEM',
    color: 'blue',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
];

const demoBankQuestions = [
  {
    id: 'demo-bq-1',
    groupId: 'grp-alg',
    tagIds: ['tag-facil'],
    type: 'objective',
    points: 1.0,
    prompt: 'Qual dos seguintes números é um número primo?',
    options: [
      { id: 'bq1_a', label: 'A', text: '17', isCorrect: true },
      { id: 'bq1_b', label: 'B', text: '21', isCorrect: false },
      { id: 'bq1_c', label: 'C', text: '27', isCorrect: false },
      { id: 'bq1_d', label: 'D', text: '35', isCorrect: false },
    ],
    notes: 'Questão introdutória de teoria dos números.',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'demo-bq-2',
    groupId: 'grp-alg',
    tagIds: ['tag-media', 'tag-enem'],
    type: 'objective',
    points: 1.5,
    prompt: 'Considere a equação quadrática $f(x) = x^2 - 4x + 3$. Quais são as raízes reais dessa função?',
    options: [
      { id: 'bq2_a', label: 'A', text: '$x = -1$ e $x = -3$', isCorrect: false },
      { id: 'bq2_b', label: 'B', text: '$x = 1$ e $x = 3$', isCorrect: true },
      { id: 'bq2_c', label: 'C', text: '$x = 2$ e $x = 4$', isCorrect: false },
      { id: 'bq2_d', label: 'D', text: '$x = 0$ e $x = 3$', isCorrect: false },
    ],
    notes: 'Aplica fatoração simples por soma e produto.',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'demo-bq-3',
    groupId: 'grp-alg',
    tagIds: ['tag-dificil'],
    type: 'subjective',
    points: 2.5,
    prompt: 'Demonstre passo a passo o cálculo das coordenadas do vértice $(x_v, y_v)$ da função quadrática $f(x) = -x^2 + 6x - 5$.',
    linesForAnswer: 8,
    solution: 'x_v = -b/(2a) = -6/(-2) = 3; y_v = -(36 - 20)/(-4) = 4. Vértice: (3, 4).',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'demo-bq-4',
    groupId: 'grp-geo',
    tagIds: ['tag-facil'],
    type: 'objective',
    points: 1.5,
    prompt: 'Em um triângulo retângulo, a hipotenusa mede $10\\text{ cm}$ e um dos catetos mede $6\\text{ cm}$. O valor do outro cateto é:',
    options: [
      { id: 'bq4_a', label: 'A', text: '$4\\text{ cm}$', isCorrect: false },
      { id: 'bq4_b', label: 'B', text: '$5\\text{ cm}$', isCorrect: false },
      { id: 'bq4_c', label: 'C', text: '$7\\text{ cm}$', isCorrect: false },
      { id: 'bq4_d', label: 'D', text: '$8\\text{ cm}$', isCorrect: true },
      { id: 'bq4_e', label: 'E', text: '$9\\text{ cm}$', isCorrect: false },
    ],
    notes: 'Terno pitagórico elementar 3-4-5 multiplicado por 2.',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'demo-bq-5',
    groupId: 'grp-geo',
    tagIds: ['tag-media'],
    type: 'objective',
    points: 1.5,
    prompt: 'A figura abaixo ilustra o gráfico de uma trajetória parabólica em um sistema cartesiano de coordenadas.',
    imageUrl: `asset:${imgShortHash}.png`,
    imageCaption: 'Figura 1: Esboço da curva parabólica no plano cartesiano',
    options: [
      { id: 'bq5_a', label: 'A', text: 'O coeficiente principal é positivo', isCorrect: false },
      { id: 'bq5_b', label: 'B', text: 'A função não possui raízes reais', isCorrect: false },
      { id: 'bq5_c', label: 'C', text: 'O vértice da parábola representa um ponto de máximo local', isCorrect: true },
      { id: 'bq5_d', label: 'D', text: 'O eixo de simetria coincide com o eixo vertical', isCorrect: false },
    ],
    notes: 'Análise qualitativa de concavidade e vértice.',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'demo-bq-6',
    groupId: 'grp-calc',
    tagIds: ['tag-media'],
    type: 'objective',
    points: 2.0,
    prompt: 'Calcule a integral definida $\\int_{0}^{2} (3x^2 + 1)\\,dx$ e selecione o resultado correto:',
    options: [
      { id: 'bq6_a', label: 'A', text: '$10$', isCorrect: true },
      { id: 'bq6_b', label: 'B', text: '$12$', isCorrect: false },
      { id: 'bq6_c', label: 'C', text: '$8$', isCorrect: false },
      { id: 'bq6_d', label: 'D', text: '$14$', isCorrect: false },
    ],
    notes: 'Primitiva: x^3 + x avaliada de 0 a 2: (8 + 2) - 0 = 10.',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
];

const demoBankBlueprints = [
  {
    id: 'demo-bp-1',
    name: 'Modelo Geral Bimestral',
    description: 'Sorteia questões equilibradas entre Álgebra e Geometria com diferentes dificuldades.',
    blocks: [
      {
        id: 'blk-1',
        source: { kind: 'group', groupId: 'grp-alg', descendants: true },
        quotas: [
          {
            id: 'q-1',
            count: 1,
            filter: { tagIds: ['tag-facil'], notTagIds: [] },
            points: 1.0,
          },
          {
            id: 'q-2',
            count: 1,
            filter: { tagIds: ['tag-media'], notTagIds: [] },
            points: 1.5,
          },
        ],
      },
      {
        id: 'blk-2',
        source: { kind: 'group', groupId: 'grp-geo', descendants: true },
        quotas: [
          {
            id: 'q-3',
            count: 1,
            filter: { tagIds: ['tag-facil'], notTagIds: [] },
            points: 1.5,
          },
          {
            id: 'q-4',
            count: 1,
            filter: { tagIds: ['tag-media'], notTagIds: [] },
            points: 1.5,
          },
        ],
      },
    ],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
];

// 6. Configurar Profile Payload
const profilePayload = {
  exams: [exam],
  classes: [classroom],
  records,
  settings: {
    activeExamId: exam.id,
    activeClassId: classroom.id,
  },
  bank: {
    groups: demoBankGroups,
    tags: demoBankTags,
    questions: demoBankQuestions,
    blueprints: demoBankBlueprints,
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
    bankQuestions: demoBankQuestions.length,
    bankGroups: demoBankGroups.length,
    bankTags: demoBankTags.length,
    bankBlueprints: demoBankBlueprints.length,
  },
  includes: {
    records: true,
    classes: true,
    passwords: true,
    bank: true,
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
