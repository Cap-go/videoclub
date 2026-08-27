const LIVE_VISITORS_WIDGET_SRC =
  "https://datafa.st/widgets/6a90233b9514c70c504828be/realtime?mainTextSize=16&primaryColor=%23e78468&theme=light";

export function LiveVisitors() {
  return (
    <div className="flex h-12 w-full max-w-[320px] shrink-0 items-center bg-transparent sm:h-10 sm:w-[280px] sm:max-w-none">
      <iframe
        src={LIVE_VISITORS_WIDGET_SRC}
        title="DataFast Widget"
        loading="lazy"
        allowTransparency
        className="h-full w-full border-0 bg-transparent"
      />
    </div>
  );
}

export { LIVE_VISITORS_WIDGET_SRC };
