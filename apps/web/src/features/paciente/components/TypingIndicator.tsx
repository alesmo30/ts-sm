export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-[4px] border border-border bg-surface-2 px-[15px] py-[13px]">
        <span className="h-[6px] w-[6px] rounded-full bg-muted [animation:blink_1.2s_infinite]" />
        <span className="h-[6px] w-[6px] rounded-full bg-muted [animation:blink_1.2s_infinite_.2s]" />
        <span className="h-[6px] w-[6px] rounded-full bg-muted [animation:blink_1.2s_infinite_.4s]" />
      </div>
    </div>
  );
}
