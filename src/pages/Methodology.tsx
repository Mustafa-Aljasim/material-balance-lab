import type { Model } from "../types";
import { MathBlock } from "../components/Math";
const references = [
  [
    "Havlena & Odeh (1963) · The Material Balance as an Equation of a Straight Line",
    "https://doi.org/10.2118/559-PA",
  ],
  [
    "Vasquez & Beggs (1980) · Correlations for Fluid Physical Property Prediction",
    "https://doi.org/10.2118/6719-PA",
  ],
  [
    "Dranchuk & Abou-Kassem (1975) · Calculation of Z Factors for Natural Gases Using Equations of State",
    "https://doi.org/10.2118/75-03-03",
  ],
  [
    "Sutton (1985) · Compressibility Factors for High-Molecular-Weight Reservoir Gases",
    "https://doi.org/10.2118/14265-MS",
  ],
  [
    "Texas A&M / Blasingame · PVT course appendix (Sutton equations)",
    "https://blasingame.engr.tamu.edu/z_zCourse_Archive/P613_24A/P613_Reference/%5B1988%5D_PVT_Appendix_%28Blasingame%29_%28pdf%29.pdf",
  ],
];
export function Methodology({ model }: { model: Model }) {
  return (
    <div className="methodology">
      <div className="page-title">
        <div>
          <span className="eyebrow">
            LEARN THE MODEL, QUESTION THE ASSUMPTIONS
          </span>
          <h2>Methodology & equations</h2>
          <p>
            A transparent 0D tank formulation with field-unit numerical
            accounting.
          </p>
        </div>
      </div>
      <section className="card">
        <h3>The reservoir as a tank</h3>
        <p>
          Material balance relates fluid withdrawal to expansion and influx at
          uniform, equilibrated reservoir pressure and constant temperature. It
          estimates an effective connected inventory. It does not simulate well
          deliverability, spatial pressure gradients, multiphase flow or
          relative permeability. Correlations approximate sweet black oil / dry
          gas; they do not model volatile oil, condensate dropout, sour gas or
          changing composition.
        </p>
        <MathBlock
          equation={
            model === "oil"
              ? "F=N(E_o+E_g+E_{fw})+W_e=NE_t+W_e"
              : "F=G[(B_g-B_{gi})+E_{fw}]+W_e=GE_t+W_e"
          }
        />
        <p>
          F = net underground withdrawal (rb); N = initial stock-tank oil (STB);
          G = initial gas at standard conditions (scf); We = cumulative
          reservoir-volume influx (rb). Et is expansion per unit initial
          hydrocarbon (rb/STB for oil, rb/scf for gas). All pressure is
          absolute. “i” denotes initial PVT at pi; “inj” denotes injected-fluid
          FVF.
        </p>
      </section>
      <section className="card">
        <h3>Oil withdrawal & expansion</h3>
        <MathBlock
          equation={"F=N_pB_o+(G_p-N_pR_s)B_g+W_pB_w-W_iB_{w,inj}-G_iB_{g,inj}"}
        />
        <p>
          Np, Wp and Wi are cumulative stock-tank oil, water production and
          water injection (STB). Gp and Gi are cumulative produced and injected
          gas (scf). Bo and Bw are liquid FVFs (rb/STB); Bg is gas FVF (rb/scf);
          Rs is dissolved gas (scf/STB). Rp = Gp/Np is undefined at Np = 0; the
          expanded equation above remains usable. Injection is subtracted,
          reducing net withdrawal.
        </p>
        <MathBlock equation={"E_o=(B_o-B_{oi})+(R_{si}-R_s)B_g"} />
        <MathBlock
          equation={String.raw`E_g=mB_{oi}\left(\frac{B_g}{B_{gi}}-1\right)`}
        />
        <MathBlock
          equation={String.raw`E_{fw}=(1+m)B_{oi}\frac{c_f+S_{wi}c_w}{1-S_{wi}}(p_i-p)`}
        />
        <p>
          m = initial gas-cap / oil reservoir-volume ratio. It is included once
          in Eg and once in the pore-volume multiplier. cf and cw are rock and
          water compressibilities (psi⁻¹); Swi is initial connate-water
          saturation. Rsi and Boi are read from the selected PVT source at pi.
          The linearized rock/water term assumes small compressibility ×
          pressure change.
        </p>
      </section>
      <section className="card">
        <h3>Havlena–Odeh & Campbell</h3>
        <MathBlock
          equation={String.raw`\underbrace{F-W_e}_{Y}=N\underbrace{E_t}_{X},\qquad \text{Campbell: }\ Y=\frac{F-W_e}{E_t},\ X=F`}
        />
        <p>
          Havlena–Odeh rearranges the MBE into a straight-line consistency
          check. The lab shows entered N and a least-squares fit constrained
          through the origin, using active pressure surveys with nonzero Et. The
          slope is an inventory estimate only for an adequate PVT/expansion
          model and known or negligible influx. When correction is disabled and
          influx is present, the fit is descriptive and is not a valid N
          estimate.
        </p>
        <p>
          Campbell divides net (or influx-corrected) withdrawal by Et to show
          apparent N. A plateau is consistent with an appropriate tank model. An
          upward trend may suggest unaccounted pressure support; scatter may be
          caused by survey timing, volume errors, compartmentalization or PVT.
          Very small Et makes ratios unstable; |Et| ≤ 10⁻¹⁰ rb/STB is omitted.
          Plot shapes do not uniquely identify a drive mechanism.
        </p>
      </section>
      <section className="card">
        <h3>Dry-gas volume balance, p/Z & Cole</h3>
        <MathBlock equation={"F=G_pB_g+W_pB_w-W_iB_{w,inj}-G_iB_{g,inj}"} />
        <MathBlock
          equation={String.raw`E_t=(B_g-B_{gi})+B_{gi}\frac{c_f+S_{wi}c_w}{1-S_{wi}}(p_i-p)`}
        />
        <MathBlock
          equation={String.raw`\frac{p}{Z}=\frac{p_i}{Z_i}\left(1-\frac{G_p}{G}\right)`}
        />
        <p>
          The p/Z straight line requires a volumetric, constant-temperature
          reservoir without injection, water production, aquifer support or
          significant pore-volume change. In this lab, any nonzero rock/water
          term, relevant water volume or injection, aquifer storage, or
          inconsistent Bg/Z relationship disables the straight-line reference
          and extrapolation. Measured p/Z points remain available for diagnosis.
          Deviation may reflect influx, data errors or assumption violations.
        </p>
        <MathBlock
          equation={String.raw`\text{Cole: }\ Y=\frac{F-W_e}{E_t},\qquad X=G_p`}
        />
        <p>
          Cole compares apparent G with entered OGIP. The lab includes the
          declared rock/water contribution in total Et and optionally subtracts
          influx. A horizontal trend supports consistency, conditional on the
          assumptions. |Et| ≤ 10⁻¹² rb/scf is omitted. The volumetric p/Z
          regression is unconstrained with a fitted intercept and slope; active
          measured surveys only are used. A negative slope permits a descriptive
          Gp-axis intercept.
        </p>
      </section>
      <section className="card">
        <h3>PVT correlations & interpolation</h3>
        <MathBlock
          equation={String.raw`P_{pc}=756.8-131\gamma_g-3.6\gamma_g^2,\quad T_{pc}=169.2+349.5\gamma_g-74\gamma_g^2`}
        />
        <MathBlock
          equation={String.raw`B_g=0.005035\frac{Z(T_F+459.67)}{p}\quad[\mathrm{rb/scf}]`}
        />
        <p>
          Sutton gives sweet-gas pseudo-critical properties (psia, °R). DAK
          solves for reduced density by a bracketed gas-branch root. The
          implementation admits 1.05 ≤ Tpr ≤ 3 and 0.2 ≤ Ppr ≤ 30. Optional
          entered Zi multiplicatively calibrates the entire DAK curve at pi,
          preserving Bg ∝ Z/p; it is explicitly a calibrated correlation. The
          standard-volume convention is approximately 14.7 psia and 60 °F,
          implicit in the 0.005035 coefficient.
        </p>
        <MathBlock
          equation={String.raw`R_s(p)=R_{si}\left(\frac{\min(p,P_b)}{P_b}\right)^{c},\quad c=1.0937\ (API\leq30),\ 1.187\ (API>30)`}
        />
        <p>
          This is the published Vasquez–Beggs Rs pressure dependence, normalized
          to entered Rsi at Pb. It is a calibrated form, not an independent
          bubble-point prediction. pi must be ≥ Pb. Below Pb, Bo uses published
          VB saturated coefficients. Above Pb, Rs stays at Rsi and Bo =
          Bob(Pb/p)^A integrates the published co = A/p relation continuously.
          Bw is constant as entered; cw represents connate-water storage
          separately. Applicability checks reject unsupported oil temperature,
          gravity or negative compressibility results.
        </p>
        <p>
          Uploaded PVT values are piecewise-linearly interpolated in pressure,
          independently for supplied properties. Oil Z is optional. Above-Pb
          Bo-only tables use m=0 and constant associated solution gas
          cancellation, with no invented Rs/Bg. Bw requires a supplied table or
          an explicitly approved constant. The PVT QC panel shows
          selected-source initial properties and suspect trends. No
          extrapolation occurs unless expressly enabled. Bg and Z may not remain
          perfectly thermodynamically consistent between coarse laboratory
          points; p/Z reference is suppressed if the discrepancy exceeds 0.5%.
          Both the diagnostics and pressure solver call the same PVT provider.
          Correlations are estimates and do not replace representative
          laboratory PVT.
        </p>
      </section>
      <section className="card">
        <h3>Aquifer storage & signed drive indices</h3>
        <MathBlock
          equation={String.raw`W_e=C_{aq}(p_i-p),\quad I_o=NE_o/F,\quad I_g=NE_g/F,\quad I_{fw}=NE_{fw}/F,\quad I_w=W_e/F`}
        />
        <p>
          None is the default. Pot uses an effective equilibrium storage
          coefficient Caq (rb/psi); it has no time delay or transient flow.
          Signed backflow occurs above pi. Fetkovich and Van Everdingen–Hurst
          are future extension points, not selectable models. Oil drive indices
          use signed model support divided by measured net withdrawal; they are
          suppressed for |F| &lt; 1 rb and are never renormalized. The total
          equals 100% only when the model closes. Closure tolerance for the
          educational status is max(1 rb, 0.1% |F|).
        </p>
      </section>
      <section className="card">
        <h3>Independent pressure prediction & manual matching</h3>
        <p>
          At every history row the engine solves support(p) − withdrawal(p) = 0
          without reading measured pressure or Use. It scans 100 intervals
          across the supported domain, including pi, Pb and all table knots, and
          bisects detected sign changes to 10⁻¹⁰ psi (up to 100 iterations).
          Final closure must satisfy max(10⁻⁴ rb, 10⁻⁸ of the larger
          withdrawal/support magnitude). Multiple detected roots produce an
          ambiguity warning; nearest pi is displayed, but fitting rejects
          ambiguous candidates. Finite scanning can miss tangent or tightly
          spaced roots. Correlation searches are limited to supported reduced
          pressure and a maximum max(1.6pi, pi + 1000 psi); a table restricts
          the bracket to its coverage unless extrapolation is enabled. No
          bracket, unsupported properties or nonconvergence produce an explicit
          missing prediction and warning. Under extreme injection or
          nonmonotone/inconsistent PVT a unique physical root is not guaranteed.
        </p>
        <MathBlock
          equation={String.raw`r_i=p_{calc,i}-p_{meas,i},\quad RMSE=\sqrt{\frac{1}{n}\sum r_i^2},\quad MAE=\frac{1}{n}\sum |r_i|`}
        />
        <p>
          Only active surveys with valid predictions enter errors; active and
          solved counts are both reported. A failed active row must not be
          overlooked when interpreting a small RMSE. Excluding a survey does not
          remove its production history. Manual sliders change N/G, m and Caq.
          Oil Auto Match supports bounded N, N+m or N+Pot Caq: golden-section
          search for N, deterministic grid seeding and bounded Nelder–Mead for
          two parameters. Every active survey must have a unique valid root. PVT
          and unselected inputs stay fixed. Review before/after pressure errors,
          convergence, boundary warnings and finite-difference
          sensitivity/correlation; a good fit does not establish unique
          parameters. Rate histories use interval-ending rectangular integration
          by default or optional trapezoidal integration; cumulatives are never
          averaged.
        </p>
      </section>
      <section className="card">
        <h3>Gas-cap parameter interpretation</h3>
        <MathBlock
          equation={String.raw`K=B_{oi}\frac{c_f+S_{wi}c_w}{1-S_{wi}}(p_i-p),\quad \frac{F-W_e}{E_o+K}=N+Nm\frac{E_g^0+K}{E_o+K}`}
        />
        <p>
          Here Eg⁰ = Boi(Bg/Bgi−1) excludes m. The general intercept/slope fit
          includes m in the rock multiplier through K. When compressibility is
          zero it reduces to F/Eo versus Eg⁰/Eo. Strong coefficient correlation,
          extrapolation to the intercept and rounded PVT can make N and m poorly
          determined. The Dake workspace quantifies rounding and leave-one-out
          sensitivity.
        </p>
      </section>
      <section className="card">
        <h3>Published-source checks & synthetic known-answer cases</h3>
        <p>
          Engineering QC & Case Studies separates verified term arithmetic from
          incomplete field reconstructions. Virginia Hills retains its
          published-answer discrepancy; Dake verifies the approximate fixed-m
          result; Iraqi Tertiary is partial because source cumulatives and
          missing assumptions prevent exact reproduction; SABA lacks complete
          PVT/history and includes unsupported transient/multi-tank physics. No
          unpublished dates or pressure history are fabricated.
        </p>
        <p>
          West Ridge oil: N = 85 MMSTB, m = 0.18, pi = 4,200 psia, T = 190 °F,
          Pb = 2,800 psia, Rsi = 650 scf/STB. Prescribed survey pressures pᵢ =
          4,200 − 155i psia for i = 0…16; producing GOR = 650 + 55i and Wp =
          0.12Np. Production is obtained by algebraically rearranging the
          governing balance. The last survey is 1,720 psia.
        </p>
        <p>
          North Basin dry gas: G = 180 Bscf, pi = 4,200 psia, T = 190 °F, gas
          gravity = 0.7, zero rock/water compressibility and aquifer None.
          Prescribed pressures pᵢ = 4,200 − 175i psia, ending at 1,400 psia. Gp
          = G(1 − Bgi/Bg). The pressure solver must recover these independently
          generated pressures to within 10⁻⁴ psi; the p/Z zero intercept is G.
          These are exact synthetic teaching examples, not field measurements.
        </p>
      </section>
      <section className="card references">
        <h3>Engineering references</h3>
        {references.map(([title, href]) => (
          <a key={href} href={href} target="_blank" rel="noreferrer">
            {title} ↗
          </a>
        ))}
        <p>
          Implementation equations, coefficients, unit conventions and
          validation limitations are also documented in ENGINEERING_METHODS.md
          in the project source. Passing numerical tests verifies those test
          conditions; it is not independent field validation or reserves
          certification.
        </p>
      </section>
    </div>
  );
}
