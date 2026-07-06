/**
 * Animated connector dots between algorithm question cards.
 */
export const ConnectorDots = ({ colorClass }: { colorClass: string }) => (
    <div className="flex flex-col items-center py-1">
        <div className={`connector-dot ${colorClass}`} style={{ animationDelay: '0ms' }} />
        <div className={`connector-dot ${colorClass}`} style={{ animationDelay: '100ms' }} />
        <div className={`connector-dot ${colorClass}`} style={{ animationDelay: '200ms' }} />
        <div className={`connector-dot ${colorClass}`} style={{ animationDelay: '290ms' }} />
    </div>
);
