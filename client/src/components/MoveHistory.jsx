import { useEffect, useRef, useMemo } from 'react';

export default function MoveHistory({ moves }) {
  const listRef = useRef(null);

  // Auto-scroll to the latest move
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [moves]);

  // Group moves into pairs (white, black)
  const movePairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: moves[i] || null,
        black: moves[i + 1] || null,
      });
    }
    return pairs;
  }, [moves]);

  return (
    <div className="move-history-panel">
      <div className="move-history-header">Move History</div>
      <div className="move-history-list" ref={listRef}>
        {movePairs.length === 0 ? (
          <div className="move-history-empty">No moves yet</div>
        ) : (
          movePairs.map((pair) => (
            <div key={pair.number} className="move-history-row">
              <span className="move-number">{pair.number}.</span>
              <span className="move-white">{pair.white || ''}</span>
              <span className="move-black">{pair.black || ''}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
