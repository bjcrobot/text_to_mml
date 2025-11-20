# Text to MML Music Converter

テキストを解析して音楽（MML: Music Macro Language）に変換し、再生するツールです。
Webアプリケーション版と、コマンドラインで動作するPythonスクリプト版があります。

## 機能

*   **テキスト解析**: 入力されたテキストを独自のルールに基づいてMMLに変換します。
*   **Web再生**: ブラウザ上で変換結果をすぐに再生・一時停止・停止できます。
*   **MIDIエクスポート**: Python版を使用すると、MMLをMIDIファイルとして保存できます。

## 変換ルール概要

1.  **音程**: 2文字ペアの **1文字目** の文字コードに基づいて決定 (C, C#, D...)
2.  **オクターブ**: 1文字目の文字種別で変化 (ひらがな: o5, カタカナ: o4, 漢字: o3, その他: o4)
3.  **リズム（音長・休符）**: 2文字ペアの **2文字目** の文字コードに基づいて決定
    *   16分音符、8分音符、4分音符、2分音符、付点8分音符、または休符が割り当てられます。
    *   これにより、単調さを防ぎ、より音楽的なリズムが生成されます。
4.  **テンポ**: 行の長さによってテンポが変化 (短い行は速く、長い行は遅く)

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
python text_to_mml.py input.txt
```

**MIDIファイルのエクスポート:**

```bash
python text_to_mml.py input.txt --midi output.mid
```

**楽器選択:**

```bash
# Options: piano, chiptune, strings, flute, guitar, lead
python text_to_mml.py input.txt --midi output.mid --instrument chiptune
```

### 依存ライブラリ

MIDI出力機能を使用するには `midiutil` が必要です。

```bash
pip install midiutil
```

## ライセンス

MIT
