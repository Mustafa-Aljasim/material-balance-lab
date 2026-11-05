# Source fixtures and interpretation

These files preserve numerical source values and printed units, independently of the calculation engine. No production dates are synthesized for pressure-indexed exercises. The Dake initial row explicitly adds zero production to the published initial PVT state; its Rp cell remains blank because 0/0 is undefined.

| Fixture                                | Provenance                                                                                                                                           | Scope                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| virginia-hills.csv                     | User-supplied Advanced Reservoir Engineering Example 4.3, pp.309–310; raw table corroborated by publisher ScienceDirect, Ahmed Handbook Example 11-3 | Raw data gives 282.829065946 MMSTB, not printed 257                                    |
| dake.csv                               | Dake Exercise 3.4, pp.87–90; raw values corroborated by TAMU thesis Table 3.1 (printed p.14)                                                         | Fixed-m arithmetic checks; rounded data do not uniquely identify N/m                   |
| iraqi-tertiary-table1.csv / table2.csv | https://vurup.sk/download/3145/3417, printed p.451; both tables visually checked against the PDF                                                     | PARTIAL_VALIDATION; derived cumulative gas decreases for the printed Rp interpretation |
| saba-published-summary.json            | https://ojs.uni-miskolc.hu/index.php/geosciences/article/download/2221/1870/10575, Tables 1–4; Table 1/2 visually reviewed                           | INSUFFICIENT_SOURCE_DATA; no digitized or invented field history                       |

Publisher corroboration: https://www.sciencedirect.com/topics/engineering/material-balance-equation

Primary research corroboration of Dake: https://oaktrust.library.tamu.edu/server/api/core/bitstreams/94c5a927-f3c0-407c-8f73-7020add8963b/content

The source PDFs are not redistributed. Independent expected arithmetic is stored in `src/tests/benchmarks/term-answers.json`; its numeric constants were derived with 40-digit decimal arithmetic outside the TypeScript engine. Input rows can be exported, edited and recalculated as temporary copies in Engineering QC & Case Studies. Edited sources are not presented as the original published dataset.
