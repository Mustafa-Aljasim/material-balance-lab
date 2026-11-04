import { useEffect, useRef, useState } from "react";
import type {
  Data,
  Layout,
  PlotlyHTMLElement,
  PlotMouseEvent,
} from "plotly.js";
import { Download, Maximize2, MousePointer2 } from "lucide-react";
import Plotly from "plotly.js-basic-dist-min";
export const colors = {
  green: "#316557",
  orange: "#ce7d43",
  blue: "#688baf",
  olive: "#a0a86b",
  gray: "#a4aaa5",
};
export function Chart({
  title,
  subtitle,
  data,
  xTitle,
  yTitle,
  onPoint,
  height = 330,
  layout = {},
}: {
  title: string;
  subtitle?: string;
  data: Data[];
  xTitle: string;
  yTitle: string;
  onPoint?: (id: string) => void;
  height?: number;
  layout?: Partial<Layout>;
}) {
  const ref = useRef<HTMLDivElement>(null),
    clickRef = useRef(onPoint);
  const [error, setError] = useState("");
  clickRef.current = onPoint;
  useEffect(() => {
    const el = ref.current!;
    let live = true;
    Plotly.newPlot(el, [], {}, { responsive: true })
      .then((gd) => {
        if (!live) return;
        (gd as PlotlyHTMLElement).on(
          "plotly_click",
          (event: PlotMouseEvent) => {
            const id = event.points[0]?.customdata;
            clickRef.current?.(typeof id === "string" ? id : "model:reference");
          },
        );
      })
      .catch((e) => setError(String(e)));
    const observer = new ResizeObserver(() => {
      if (el.classList.contains("js-plotly-plot")) Plotly.Plots.resize(el);
    });
    observer.observe(el);
    return () => {
      live = false;
      observer.disconnect();
      Plotly.purge(el);
    };
  }, []);
  useEffect(() => {
    const el = ref.current!;
    Plotly.react(
      el,
      data,
      {
        height,
        autosize: true,
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        font: {
          family: "Inter, Segoe UI, sans-serif",
          size: 11,
          color: "#7a817b",
        },
        margin: { l: 68, r: 25, t: 15, b: 63 },
        xaxis: {
          title: { text: xTitle, standoff: 15 },
          gridcolor: "#eff0ea",
          zerolinecolor: "#e6e9e2",
          tickfont: { size: 10 },
          automargin: true,
        },
        yaxis: {
          title: { text: yTitle, standoff: 12 },
          gridcolor: "#eff0ea",
          zerolinecolor: "#e6e9e2",
          tickfont: { size: 10 },
          automargin: true,
        },
        legend: { orientation: "h", y: 1.13, x: 0, font: { size: 10 } },
        hovermode: "closest",
        dragmode: "zoom",
        uirevision: title,
        ...layout,
      },
      {
        responsive: true,
        displaylogo: false,
        scrollZoom: false,
        displayModeBar: "hover",
        modeBarButtonsToRemove: ["lasso2d", "select2d"],
        toImageButtonOptions: {
          format: "png",
          filename: title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
          scale: 2,
          width: 1200,
          height: 700,
        },
      },
    ).catch((e) => setError(String(e)));
  }, [data, height, layout, title, xTitle, yTitle]);
  return (
    <section className="chart-card">
      <div className="chart-heading">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="chart-actions">
          <button
            title="Reset axes"
            aria-label={`Reset ${title} axes`}
            onClick={() =>
              Plotly.relayout(ref.current!, {
                "xaxis.autorange": true,
                "yaxis.autorange": true,
              })
            }
          >
            <Maximize2 size={15} />
          </button>
          <button
            title="Download PNG"
            aria-label={`Download ${title} PNG`}
            onClick={() =>
              Plotly.downloadImage(ref.current!, {
                format: "png",
                filename: title,
                width: 1200,
                height: 700,
                scale: 2,
              })
            }
          >
            <Download size={15} />
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="notice error">
          {error}
        </p>
      ) : (
        <div ref={ref} className="plot" style={{ minHeight: height }} />
      )}
      <div className="chart-foot">
        <MousePointer2 size={12} /> Drag to zoom · double-click to reset · click
        a survey to inspect
      </div>
    </section>
  );
}
