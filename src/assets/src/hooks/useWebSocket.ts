import { useState, useEffect } from "react";
import { WebSocket } from "partysocket";

interface OfficeHoursMessage<T> {
  type: "init" | "update" | "deleted";
  content: T;
}

export const useWebSocket = <T>(
  url: string,
  onUpdate: (content: T) => void,
  onDelete?: (
    setError: React.Dispatch<React.SetStateAction<Error | undefined>>
  ) => void
) => {
  const [error, setError] = useState(undefined as Error | undefined);
  useEffect(() => {
    const ws = new WebSocket(url, undefined, {
      maxRetries: 10,
    });
    ws.onmessage = (e: MessageEvent) => {
      const m = JSON.parse(e.data) as OfficeHoursMessage<T>;
      console.debug(m);
      switch (m.type) {
        case "init":
        case "update":
          onUpdate(m.content as T);
          break;
        case "deleted":
          if (onDelete) {
            onDelete(setError);
          } else {
            throw new Error("Unexpected message type 'deleted': " + e);
          }
          break;
      }
    };
    ws.onclose = (e) => {
      if (e.code === 4404) {
        // Equivalent of HTTP 404
        setError(
          new Error(
            "The resource you're looking for does not exist. Maybe it was deleted?"
          )
        );
        ws.close();
      } else if (e.code === 4405) {
        // Custom 4404
        setError(
          new Error(
            "Oops! It looks like you've entered an invalid queue ID in the URL. Please make sure to enter the correct numeric queue ID. You can find the accurate queue ID in your 'Manage Queue' list for reference."
          )
        );
        ws.close();
      } else if (e.code === 1011) {
        // Equivalent of HTTP 500
        setError(
          new Error(
            "Sorry, there was a system error. Please try refreshing. If you continue to receive this error, contact the ITS Service Center."
          )
        );
        ws.close();
      } else if (e.code === 1001) {
        // Page refreshed (Firefox)
        ws.close();
      } else {
        // Retry all others
        console.error(e);
        setError(
          new Error(
            `The connection unexpectedly closed (error code: ${e.code.toString()}). Trying to reconnect...`
          )
        );
      }
    };
    ws.onopen = (e) => {
      setError(undefined);
    };
    ws.onerror = (e) => {
      console.error("ws.onerror");
      console.error(e);
      const errorName = e?.error?.name as string | undefined; // On Safari, Event is sometimes emitted instead of ErrorEvent
      const errorText = errorName ? ` (${errorName})` : "";
      const errorBeginning = `An unexpected error occurred${errorText}. `;
      const errorEnding =
        ws.retryCount < 10
          ? "Trying to reconnect..."
          : "Unable to reconnect; please refresh the page.";
      setError(new Error(errorBeginning + errorEnding));
    };
    return () => {
      ws.onclose = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.close();
    };
  }, [url]);
  return error;
};