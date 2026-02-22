export type FileType = 'image' | 'video' | 'audio' | 'pdf' | 'office' | 'text' | 'code' | 'unknown';

export const getFileType = (filename: string): FileType => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'mov', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) return 'office';
  if (['txt', 'md', 'json', 'csv', 'log', 'xml'].includes(ext)) return 'text';
  if (['py', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'java', 'c', 'cpp', 'rs', 'go', 'php'].includes(ext)) return 'code';
  return 'unknown';
};
