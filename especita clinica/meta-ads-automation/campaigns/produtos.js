// Configuração de público por produto — Meta Ads (clique direto pro WhatsApp).
//
// Fontes: especita clinica/plano-midia-2026-10/02-PUBLICOS-E-PERSONAS.md (pesquisa local já
// validada com a Dra. em 05/10/2026) + pesquisa externa em agências brasileiras especializadas
// em marketing odontológico/estético (Odonto Results, Prospecta Odonto, OdontoRise — buscas de
// 05/10/2026) pra confirmar faixa etária e ângulo por tratamento. Harmonização Facial liberada
// (confirmação jurídica resolvida — não é mais um bloqueio). "Noivos" como nicho separado foi
// descartado a pedido do Salvador.
//
// Idade/gênero batem com o que as agências especializadas recomendam: estética 28-55,
// reabilitação/prótese 40-60+, pais pra infantil, homens já são ~30% do mercado de estética
// (harmonização masculina), prevenção de 20-30 anos x reposição de colágeno 35+ (fonte: mercado
// da estética facial, pesquisa 05/10/2026).
//
// genero: null = todos os gêneros. 1 = homens, 2 = mulheres (campo `genders` da Meta API).

export const PRODUTOS = [
  {
    campanha: "ESP - Urgência",
    conjuntos: [
      {
        nome: "Dente quebrado e dor de dente",
        idadeMin: 20,
        idadeMax: 65,
        genero: null,
        interesses: [], // alta intenção, sem interesse de pesquisa relevante (confirmado no plano local)
        copyRascunho: {
          headline: "Dentista de urgência em Brusque",
          texto:
            "Quebrou o dente ou está com dor que não passa? A Especitá reserva encaixe de urgência " +
            "em Brusque. Chame no WhatsApp e conte o que aconteceu.",
          descricao: "Dra. Catiucia, CRO-SC 14067 — avenida Sete de Setembro, 55",
        },
      },
    ],
  },
  {
    campanha: "ESP - Implante e Prótese",
    conjuntos: [
      {
        nome: "Implante e prótese - público principal",
        idadeMin: 45,
        idadeMax: 65,
        genero: null,
        interesses: ["Odontologia", "Implante dentário"],
        copyRascunho: {
          headline: "Implante e prótese dentária em Brusque",
          texto:
            "Prótese que solta, falta de dente ou dificuldade pra mastigar? A Dra. Catiucia avalia " +
            "seu caso com planejamento. Fale no WhatsApp.",
          descricao: "Dra. Catiucia, CRO-SC 14067 — mais de 10 anos em Brusque",
        },
      },
      {
        nome: "Implante e prótese - filhos decidindo pelos pais",
        idadeMin: 30,
        idadeMax: 55,
        genero: null,
        interesses: [],
        copyRascunho: {
          headline: "Seus pais precisam de um implante ou prótese?",
          texto:
            "Muita gente pesquisa pelos pais. A Dra. Catiucia explica as etapas com clareza, em " +
            "Brusque. Fale no WhatsApp e agende uma avaliação.",
          descricao: "Dra. Catiucia, CRO-SC 14067",
        },
      },
    ],
  },
  {
    campanha: "ESP - Ortodontia",
    conjuntos: [
      {
        nome: "Alinhador invisível",
        idadeMin: 22,
        idadeMax: 45,
        genero: null,
        interesses: ["Alinhador transparente", "Invisalign"],
        copyRascunho: {
          headline: "Alinhador invisível em Brusque",
          texto:
            "O aparelho que ninguém vê. Alinhe os dentes sem metal, com acompanhamento da Dra. " +
            "Catiucia em Brusque. Fale no WhatsApp.",
          descricao: "Dra. Catiucia, CRO-SC 14067",
        },
      },
      {
        nome: "Aparelho fixo - pais",
        idadeMin: 30,
        idadeMax: 55,
        genero: null,
        interesses: [],
        copyRascunho: {
          headline: "Quando começar o aparelho do seu filho?",
          texto:
            "Dentista da escola falou em aparelho? A Dra. Catiucia explica quando é a hora certa " +
            "de começar. Fale no WhatsApp.",
          descricao: "Dra. Catiucia, CRO-SC 14067 — Odontopediatria e Ortodontia",
        },
      },
    ],
  },
  {
    campanha: "ESP - Odontopediatria",
    conjuntos: [
      {
        nome: "Mães e pais",
        idadeMin: 25,
        idadeMax: 45,
        genero: null,
        interesses: ["Pais (criação dos filhos)"],
        copyRascunho: {
          headline: "Dentista infantil em Brusque",
          texto:
            "Criança com medo de dentista ou primeira visita do bebê? A Especitá recebe com " +
            "ambiente acolhedor, sem trauma. Fale no WhatsApp.",
          descricao: "Dra. Catiucia, CRO-SC 14067 — Odontopediatria",
        },
      },
    ],
  },
  {
    campanha: "ESP - Clareamento e Lentes",
    conjuntos: [
      {
        nome: "Clareamento personalizado",
        idadeMin: 20,
        idadeMax: 45,
        genero: 2,
        interesses: ["Clareamento dental"],
        copyRascunho: {
          headline: "Clareamento personalizado em Brusque",
          texto:
            "Sorriso branco pras festas, do jeito certo: personalizado pela Dra. Catiucia. Fale no " +
            "WhatsApp e agende sua avaliação.",
          descricao: "Dra. Catiucia, CRO-SC 14067",
        },
      },
      {
        nome: "Lente de contato dental",
        idadeMin: 25,
        idadeMax: 45,
        genero: null,
        interesses: [],
        copyRascunho: {
          headline: "Lente de contato dental em Brusque",
          texto:
            "Sorriso planejado com avaliação da Dra. Catiucia. Fale no WhatsApp e saiba se seu " +
            "caso pode usar lente de contato dental.",
          descricao: "Dra. Catiucia, CRO-SC 14067",
        },
      },
    ],
  },
  {
    campanha: "ESP - Harmonização Facial",
    conjuntos: [
      {
        nome: "Harmonização facial - geral",
        idadeMin: 30,
        idadeMax: 58,
        genero: 2,
        interesses: ["Botox", "Estética"],
        copyRascunho: {
          headline: "Harmonização Orofacial em Brusque",
          texto:
            "O que o botox faz e o que não faz, pela Dra. Catiucia (CRO-SC 14067, habilitada em " +
            "Harmonização Orofacial). Avaliação facial individual. Fale no WhatsApp.",
          descricao: "Dra. Catiucia, CRO-SC 14067 — habilitação EPAO 4417",
        },
      },
      {
        nome: "Harmonização masculina",
        idadeMin: 25,
        idadeMax: 50,
        genero: 1,
        interesses: [],
        copyRascunho: {
          headline: "Harmonização facial para homens",
          texto:
            "Homem também faz botox. Discreto, rápido, com a Dra. Catiucia em Brusque. Fale no " +
            "WhatsApp.",
          descricao: "Dra. Catiucia, CRO-SC 14067 — habilitação EPAO 4417",
        },
      },
    ],
  },
  {
    campanha: "ESP - Dentista em Brusque e Família",
    conjuntos: [
      {
        nome: "Avaliação e check-up",
        idadeMin: 25,
        idadeMax: 60,
        genero: null,
        interesses: [],
        copyRascunho: {
          headline: "Dentista em Brusque — avaliação geral",
          texto:
            "Uma clínica pra família inteira, em frente à ponte dos bombeiros. A Dra. Catiucia " +
            "cuida há mais de 10 anos de famílias de Brusque. Fale no WhatsApp.",
          descricao: "Dra. Catiucia, CRO-SC 14067",
        },
      },
    ],
  },
];

export const CIDADES = ["Brusque", "Botuverá", "Nova Trento", "São João Batista", "Guabiruba"];

// Agendamento: seg-sex, 7h-21h (precisa de orçamento vitalício, ver lib/metaMarketingApi.js)
export const HORARIO = {
  days: [1, 2, 3, 4, 5], // 0=domingo ... 6=sábado
  start_minute: 7 * 60,
  end_minute: 21 * 60,
  timezone_type: "USER",
};

// Orçamento mínimo de teste por conjunto — ponto de partida; o script ajusta sozinho
// pra cima se o Meta recusar por ser baixo demais (erro de orçamento mínimo).
export const ORCAMENTO_DIARIO_TESTE_REAIS = 20;
export const DIAS_CAMPANHA = 30; // vira orçamento vitalício: diário × dias
