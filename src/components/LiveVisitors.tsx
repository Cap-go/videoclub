const WIDGET_SRC =
  "/widgets/6a90233b9514c70c504828be/realtime?mainTextSize=16&primaryColor=%23e78468";

export function LiveVisitors() {
  return (
    <div className="h-10 w-[220px] shrink-0 bg-transparent sm:h-11">
      <iframe
        src={WIDGET_SRC}
        title="DataFast Widget"
        loading="lazy"
        className="h-full w-full border-0 bg-transparent"
      />
    </div>
  );
}
