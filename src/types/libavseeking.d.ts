export class VideoFile {
  constructor();
  open(filename: string): boolean;
  seek(time: number): boolean;
  getCurrentTime(): number;
} 