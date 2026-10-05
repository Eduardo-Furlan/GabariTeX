import { Exam } from '../types/exam';

export const emptyExam: Exam = {
  id: 'prova-nova',
  header: {
    institution: '',
    course: '',
    professor: '',
    examTitle: '',
    date: '',
    instructions: '',
  },
  password: 'senha123',
  versionCount: 4,
  shuffleQuestions: true,
  shuffleOptions: true,
  twoColumns: true,
  questions: [],
};

export const initialSampleExam: Exam = {
  id: 'prova-mat-2026-1',
  header: {
    institution: 'Universidade Federal de Tecnologia',
    course: 'Cálculo Diferencial e Integral I',
    professor: 'Dr. Leonardo Euler',
    examTitle: 'Avaliação Parcial 1',
    date: '10/10/2026',
    instructions:
      'Leia atentamente todas as questões. É proibido o uso de calculadoras programáveis ou comunicação entre colegas. Preencha completamente a bolinha da alternativa escolhida no cartão-resposta com caneta azul ou preta.',
  },
  password: 'senha123',
  versionCount: 4,
  shuffleQuestions: true,
  shuffleOptions: true,
  twoColumns: true,
  questions: [
    {
      id: 'q1',
      type: 'objective',
      prompt: 'Calcule o limite da função racional: \\[ \\lim_{x \\to 2} \\frac{x^2 - 4}{x^2 - 3x + 2} \\]',
      points: 1.5,
      options: [
        { id: 'q1-opt1', label: 'A', text: '$4$', isCorrect: true },
        { id: 'q1-opt2', label: 'B', text: '$2$', isCorrect: false },
        { id: 'q1-opt3', label: 'C', text: '$\\infty$', isCorrect: false },
        { id: 'q1-opt4', label: 'D', text: '$0$', isCorrect: false },
        { id: 'q1-opt5', label: 'E', text: '$-2$', isCorrect: false },
      ],
    },
    {
      id: 'q2',
      type: 'objective',
      prompt:
        'Seja a função $f(x) = e^{2x} \\cos(3x)$. A derivada de primeira ordem $f\'(x)$ é dada por:',
      points: 1.5,
      options: [
        { id: 'q2-opt1', label: 'A', text: '$e^{2x}(2\\cos(3x) - 3\\sin(3x))$', isCorrect: true },
        { id: 'q2-opt2', label: 'B', text: '$2e^{2x}\\cos(3x) + 3e^{2x}\\sin(3x)$', isCorrect: false },
        { id: 'q2-opt3', label: 'C', text: '$-6e^{2x}\\sin(3x)$', isCorrect: false },
        { id: 'q2-opt4', label: 'D', text: '$e^{2x}(3\\cos(3x) - 2\\sin(3x))$', isCorrect: false },
        { id: 'q2-opt5', label: 'E', text: '$2e^{2x} - 3\\sin(3x)$', isCorrect: false },
      ],
    },
    {
      id: 'q3',
      type: 'objective',
      prompt:
        'Considere a integral definida: \\[ \\int_{0}^{\\pi/2} \\sin^2(x) \\cos(x) \\, dx \\] O valor numérico da integral é:',
      points: 1.5,
      options: [
        { id: 'q3-opt1', label: 'A', text: '$\\frac{1}{3}$', isCorrect: true },
        { id: 'q3-opt2', label: 'B', text: '$\\frac{1}{2}$', isCorrect: false },
        { id: 'q3-opt3', label: 'C', text: '$\\frac{2}{3}$', isCorrect: false },
        { id: 'q3-opt4', label: 'D', text: '$1$', isCorrect: false },
        { id: 'q3-opt5', label: 'E', text: '$\\frac{\\pi}{4}$', isCorrect: false },
      ],
    },
    {
      id: 'q4',
      type: 'objective',
      prompt:
        'Em teoria axiomática de conjuntos em ZF e lógica matemática, uma relação de equivalência sobre um conjunto não vazio $A$ deve satisfazer três propriedades fundamentais: reflexividade, simetria e transitividade. Seja $A = \\mathbb{Z}$ e a relação $a \\sim b \\iff a \\equiv b \\pmod{5}$. O número de classes de equivalência distintas geradas por essa relação é:',
      points: 1.5,
      options: [
        { id: 'q4-opt1', label: 'A', text: '$5$', isCorrect: true },
        { id: 'q4-opt2', label: 'B', text: '$4$', isCorrect: false },
        { id: 'q4-opt3', label: 'C', text: '$\\infty$', isCorrect: false },
        { id: 'q4-opt4', label: 'D', text: '$1$', isCorrect: false },
        { id: 'q4-opt5', label: 'E', text: '$10$', isCorrect: false },
      ],
    },
    {
      id: 'q5',
      type: 'objective',
      prompt:
        'Considere a matriz $M = \\begin{pmatrix} 2 & 1 \\\\ 1 & 2 \\end{pmatrix}$. Os autovalores $\\lambda_1$ e $\\lambda_2$ associados a $M$ são:',
      points: 1.5,
      options: [
        { id: 'q5-opt1', label: 'A', text: '$\\lambda_1 = 3$ e $\\lambda_2 = 1$', isCorrect: true },
        { id: 'q5-opt2', label: 'B', text: '$\\lambda_1 = 2$ e $\\lambda_2 = 2$', isCorrect: false },
        { id: 'q5-opt3', label: 'C', text: '$\\lambda_1 = 4$ e $\\lambda_2 = 0$', isCorrect: false },
        { id: 'q5-opt4', label: 'D', text: '$\\lambda_1 = -1$ e $\\lambda_2 = 3$', isCorrect: false },
        { id: 'q5-opt5', label: 'E', text: '$\\lambda_1 = 5$ e $\\lambda_2 = -1$', isCorrect: false },
      ],
    },
    {
      id: 'q6',
      type: 'subjective',
      prompt:
        'Enuncie o Teorema do Valor Médio de Lagrange para uma função $f: [a, b] \\to \\mathbb{R}$. Em seguida, determine o ponto $c \\in (1, 4)$ que satisfaz o teorema para $f(x) = x^2 - 2x + 3$. Apresente todos os cálculos detalhados.',
      points: 2.5,
      linesForAnswer: 10,
    },
  ],
};
