from typing import Callable, Dict, List, Any
import logging

logger = logging.getLogger(__name__)

class EventBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}

    def subscribe(self, event_type: str, handler: Callable):
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.info(f"Module đã đăng ký lắng nghe sự kiện: {event_type}")

    def emit(self, event_type: str, data: Any):
        if event_type in self._subscribers:
            for handler in self._subscribers[event_type]:
                try:
                    handler(data)
                except Exception as e:
                    logger.error(f"Lỗi khi xử lý sự kiện {event_type}: {e}")

bus = EventBus()
