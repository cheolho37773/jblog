'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { browserApi } from '@/lib/api/client';

// 브라우저에서 같은 오리진 /api/*가 백엔드로 이어지는지 확인한다.
export function BrowserCheck() {
  const [message, setMessage] = useState('아직 요청하지 않음');

  async function requestCategories() {
    const { data: categories, error } = await browserApi.GET('/api/categories');
    setMessage(
      categories ? `카테고리 ${categories.length}개` : `요청 실패: ${JSON.stringify(error)}`,
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Button type="button" onClick={requestCategories}>
        브라우저 요청
      </Button>
      <p data-testid="api-check-browser">{message}</p>
    </div>
  );
}
