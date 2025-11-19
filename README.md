# Text to Music Converter

テキストを解析して音楽（MML: Music Macro Language）に変換し、再生するツールです。
Webアプリケーション版と、コマンドラインで動作するPythonスクリプト版があります。

## 機能

*   **テキスト解析**: 入力されたテキストを独自のルールに基づいてMMLに変換します。
*   **Web再生**: ブラウザ上で変換結果をすぐに再生・一時停止・停止できます。
*   **MIDIエクスポート**: Python版を使用すると、MMLをMIDIファイルとして保存できます。

## 変換ルール概要

1.  **音程**: 文字コードに基づいて決定 (C, C#, D...)
2.  **オクターブ**: 文字種別で変化 (ひらがな: o5, カタカナ: o4, 漢字: o3, その他: o4)
3.  **休符**: 句読点 (、, 。) を休符に変換
4.  **音長**: 同じ文字の連続で長さを変更
5.  **テンポ**: 行の長さによってテンポが変化 (短い行は速く、長い行は遅く)

## Webアプリケーション (Frontend)

Vite + TypeScript + Tone.js で構築されています。

### セットアップ & 実行

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

ブラウザで表示されたURL（通常は `http://localhost:5173`）にアクセスしてください。

## Pythonスクリプト (CLI)

コマンドラインからテキストをMMLに変換したり、MIDIファイルを作成したりできます。
スクリプトは `python/` ディレクトリ内にあります。

### 実行方法

`python` ディレクトリに移動して実行してください。

```bash
cd python
```

**基本（MML出力）:**

```bash
python converter.py sample.txt
```

**MIDIファイルのエクスポート:**

```bash
python converter.py sample.txt --midi output.mid
```

### 依存ライブラリ

MIDI出力機能を使用するには `midiutil` が必要です。

```bash
pip install midiutil
```

## ライセンス

MIT
