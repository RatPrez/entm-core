import { System, Profiler } from "@ratprez/entm";
import type { World }       from "@ratprez/entm";

const k_x      = 0.01;
const k_y      = 0.01;
const k_scale  = 0.30;
const k_lineH  = 0.022;

const k_colUpdate = k_x + 0.005;
const k_colFixed  = k_x + 0.045;
const k_colName   = k_x + 0.090;

function drawText(text: string, x: number, y: number, r = 255, g = 255, b = 255): void {
    SetTextFont(4);
    SetTextScale(0.0, k_scale);
    SetTextColour(r, g, b, 255);
    SetTextOutline();
    BeginTextCommandDisplayText("STRING");
    AddTextComponentSubstringPlayerName(text);
    EndTextCommandDisplayText(x, y);
}

export class DebugSystem extends System {
// public
    constructor(world: World, profiler: Profiler) {
        super(world);
        this.m_profiler = profiler;
    }

    override update(deltaTime: number): void {
        if (GetConvar("sv_debug", "false") !== "true") return;

        const stats = this.m_profiler.getSorted();
        let y = k_y + 0.005;

        drawText(`[ENTM]  entities: ${this.m_world.getEntityCount()}`, k_x + 0.005, y, 100, 220, 255);
        y += k_lineH;

        drawText("update", k_colUpdate, y, 180, 180, 180);
        drawText("fixed",  k_colFixed,  y, 180, 180, 180);
        drawText("system", k_colName,   y, 180, 180, 180);
        y += k_lineH;

        for (const stat of stats) {
            const total = stat.updateMs + stat.fixedMs;
            const r     = total > 2 ? 255 : 255;
            const g     = total > 2 ? 80  : 255;
            const b     = total > 2 ? 80  : 255;

            drawText(stat.updateMs.toFixed(2) + "ms", k_colUpdate, y, r, g, b);
            drawText(stat.fixedMs.toFixed(2)  + "ms", k_colFixed,  y, r, g, b);
            drawText(stat.name,                        k_colName,   y, r, g, b);
            y += k_lineH;
        }
    }

// private
    private m_profiler: Profiler;
}
