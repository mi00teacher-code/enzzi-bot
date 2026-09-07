// ✅ 이 파일은 더 이상 Gemini API 키를 직접 다루지 않습니다.
// 실제 API 호출과 시스템 프롬프트는 /api/chat.ts (서버)로 옮겨졌습니다.
// App.tsx에서 부르는 함수 이름/파라미터는 기존과 동일하게 유지했습니다.

export type Role = "developer" | "inspector";

// App.tsx에서 첨부한 이미지/PDF를 전달할 때 쓰는 타입
export interface FilePart {
  mimeType: string;
  data: string; // base64 (data: 프리픽스 제거된 순수 데이터)
}

export async function chatWithAI(
  message: string,
  history: { role: string; parts: { text: string }[] }[],
  userRole: Role,
  filePart?: FilePart
): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, userRole, filePart }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `엔찌 서버 요청에 실패했어요 (status: ${response.status})`
    );
  }

  const data = await response.json();
  return data.text;
}
