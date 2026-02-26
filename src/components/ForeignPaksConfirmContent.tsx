import React from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from 'antd';

const { Text } = Typography;

export interface ForeignPaksConfirmContentProps {
  message: string;
  fileNames: string[];
}

/**
 * 用于「游戏 Paks 目录下其他 pak 文件」确认弹窗的内容：提示文案 + 可滚动的文件列表
 */
export function ForeignPaksConfirmContent({ message, fileNames }: ForeignPaksConfirmContentProps) {
  const { t } = useTranslation();

  return (
    <div style={{ maxWidth: 480 }}>
      <Text style={{ display: 'block', marginBottom: 12 }}>{message}</Text>
      <Text strong style={{ display: 'block', marginBottom: 6 }}>
        {t('Detected files')} ({fileNames.length})
      </Text>
      <div
        style={{
          maxHeight: 200,
          overflowY: 'auto',
          padding: '8px 12px',
          background: 'var(--ant-color-fill-quaternary)',
          borderRadius: 6,
          border: '1px solid var(--ant-color-border-secondary)',
        }}
      >
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            listStyle: 'disc',
          }}
        >
          {fileNames.map((name) => (
            <li
              key={name}
              style={{
                marginBottom: 4,
                wordBreak: 'break-all',
                fontSize: 13,
              }}
            >
              {name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
