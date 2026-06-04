export class Logger {
    constructor(private m_tag: string) {
        this.m_debug = GetConvar("sv_debug", "false") === "true";
    }

    log(msg: string): void {
        if (!this.m_debug) return;
        console.log(`[${this.m_tag}] ${msg}`);
    }

    warn(msg: string): void {
        if (!this.m_debug) return;
        console.warn(`[${this.m_tag}] ${msg}`);
    }

    error(msg: string): void {
        console.error(`[${this.m_tag}] ${msg}`);
    }

// private
    private m_debug: boolean;
}
