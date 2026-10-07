// The problem queue and the five steps of every round.
// Edit freely: add problems, reword stage prompts, change lengths.

export const PROBLEMS = [
  { name: "Riemann Hypothesis", posed: "1859", prize: "Clay Millennium Prize, $1M",
    statement: "Every non-trivial zero of the Riemann zeta function $\\zeta(s)=\\sum_{n\\ge1} n^{-s}$ (analytically continued) has real part $\\tfrac12$.",
    known: "Over $10^{13}$ zeros checked on the critical line; a positive proportion (more than 40%) of zeros are known to lie on it." },
  { name: "Collatz Conjecture", posed: "1937", prize: "",
    statement: "Iterating $n \\mapsto n/2$ for even $n$ and $n \\mapsto 3n+1$ for odd $n$ eventually reaches $1$ from every positive integer.",
    known: "Verified for all starting values below $2^{68}$; Tao (2019) showed almost all orbits attain almost bounded values." },
  { name: "Twin Prime Conjecture", posed: "1849", prize: "",
    statement: "There are infinitely many primes $p$ such that $p+2$ is also prime.",
    known: "Zhang (2013) proved bounded gaps; the Polymath project brought the bound to $\\liminf (p_{n+1}-p_n)\\le 246$." },
  { name: "Goldbach's Conjecture", posed: "1742", prize: "",
    statement: "Every even integer $n>2$ is the sum of two primes.",
    known: "Verified up to $4\\times10^{18}$; the weak (odd, three primes) version was proved by Helfgott in 2013." },
  { name: "P versus NP", posed: "1971", prize: "Clay Millennium Prize, $1M",
    statement: "Is every decision problem whose solutions can be verified in polynomial time also solvable in polynomial time, i.e. is $\\mathsf{P}=\\mathsf{NP}$?",
    known: "Relativization, natural proofs and algebrization each rule out whole families of proof techniques." },
  { name: "Navier–Stokes Regularity", posed: "2000", prize: "Clay Millennium Prize, $1M",
    statement: "For smooth, divergence-free initial data on $\\mathbb{R}^3$, do solutions of the incompressible Navier–Stokes equations stay smooth for all time?",
    known: "Global weak solutions exist (Leray, 1934); smooth solutions are known in 2D and for small data in 3D." },
  { name: "Hadwiger–Nelson Problem", posed: "1950", prize: "",
    statement: "What is the least number of colours $\\chi$ needed to colour the plane so that no two points at distance $1$ share a colour?",
    known: "de Grey (2018) proved $\\chi\\ge5$; a hexagonal tiling gives $\\chi\\le7$." },
  { name: "Odd Perfect Numbers", posed: "Antiquity", prize: "",
    statement: "Does there exist an odd integer $n$ with $\\sigma(n)=2n$, where $\\sigma$ is the sum of divisors?",
    known: "Any odd perfect number exceeds $10^{1500}$ and has at least 10 distinct prime factors." },
  { name: "Erdős–Straus Conjecture", posed: "1948", prize: "",
    statement: "For every integer $n\\ge 2$ there are positive integers $x,y,z$ with $\\frac{4}{n}=\\frac1x+\\frac1y+\\frac1z$.",
    known: "Holds for all $n$ outside a few residue classes modulo $840$ by explicit identities, and has been checked by computer to beyond $10^{17}$." },
  { name: "Legendre's Conjecture", posed: "1912", prize: "",
    statement: "For every positive integer $n$ there is a prime strictly between $n^2$ and $(n+1)^2$.",
    known: "Ingham (1937) showed a prime lies between consecutive large cubes; Legendre's case would follow from the Riemann Hypothesis only with stronger gap bounds than RH gives." },
  { name: "Lonely Runner Conjecture", posed: "1967", prize: "",
    statement: "If $k$ runners with distinct constant speeds start together on a circular track of length $1$, each runner is at some time at distance at least $\\frac{1}{k}$ from all the others.",
    known: "Proved for small numbers of runners, including every case up to seven runners (Barajas and Serra, 2008)." },
  { name: "Union-Closed Sets Conjecture", posed: "1979", prize: "",
    statement: "In every finite family of sets closed under union, other than $\\{\\varnothing\\}$, some element belongs to at least half of the sets.",
    known: "Gilmer (2022) proved some element lies in a constant fraction of the sets; follow-up work raised the fraction to about $0.38$." },
];

export const STAGES = [
  { label: "Survey", ask: "What is known and why it is hard",
    prompt: "STAGE 1, SURVEY. In about 250-350 words, lay out the landscape: the strongest known results with authors and years where you are confident, the main obstructions, and what a realistic partial result would look like. End with one sentence naming the sub-question you find most promising." },
  { label: "Angle", ask: "Choosing a line of attack",
    prompt: "STAGE 2, ANGLE. Pick ONE concrete line of attack on a special case, a weaker statement, or a reformulation. State precisely what you will try to prove, why it might work, and what it would imply. About 200-300 words. Make it different from angles tried in earlier rounds." },
  { label: "Attempt", ask: "Working the mathematics",
    prompt: "STAGE 3, ATTEMPT. Carry out the plan with real mathematics: definitions, lemmas, computations, small worked cases. Label each step as PROVEN (with argument), KNOWN (cite), or CONJECTURAL. When a step cannot be justified, say exactly where and stop pretending. About 400-700 words." },
  { label: "Referee", ask: "Hunting for the gap",
    prompt: "STAGE 4, REFEREE. You are now a skeptical referee reviewing the attempt above. Check every claim. For each numbered step say whether it holds, is unproven, or is wrong, and why. Find the precise place where the argument fails to reach the target. About 250-400 words." },
  { label: "Verdict", ask: "What this round established",
    prompt: "STAGE 5, VERDICT. In 3-6 bullet points: what (if anything) was rigorously established, where the attempt broke, and the single best idea for the next round. The problem remains open; say so plainly. Under 180 words. " +
      "End with one final line that is exactly 'STATUS: OPEN' or 'STATUS: PARTIAL'. Use PARTIAL only if a correct, rigorous, non-trivial result (for example a special case or an improved bound) was established this round AND survived the referee; otherwise OPEN." },
];

export const BASE =
  "You are The Professor, a research mathematician working LIVE, in front of an audience, on a famous open problem. " +
  "Be rigorous and honest. The problem is open: never claim to have solved or proved it, and never present a heuristic as a proof. " +
  "Separate known results (cite by author and year only when confident), heuristics, and your own new reasoning. " +
  "Write Markdown with short headers; put math in LaTeX using $...$ inline and $$...$$ for display. No preamble, no sign-off.";
