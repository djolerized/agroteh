<?php
/**
 * UTF8_FPDF - UTF-8 support for FPDF
 *
 * This class extends FPDF to add UTF-8 text encoding support.
 * It converts UTF-8 strings to Windows-1252 encoding for proper display
 * of special characters in PDF documents.
 */

if (!class_exists('FPDF')) {
    require_once __DIR__ . '/fpdf.php';
}

class UTF8_FPDF extends FPDF
{
    /**
     * Override Cell method to handle UTF-8 encoding
     */
    function Cell($w, $h=0, $txt='', $border=0, $ln=0, $align='', $fill=false, $link='')
    {
        parent::Cell($w, $h, $this->convertText($txt), $border, $ln, $align, $fill, $link);
    }

    /**
     * Override Text method to handle UTF-8 encoding
     */
    function Text($x, $y, $txt)
    {
        parent::Text($x, $y, $this->convertText($txt));
    }

    /**
     * Override MultiCell method to handle UTF-8 encoding
     */
    function MultiCell($w, $h, $txt, $border=0, $align='J', $fill=false)
    {
        parent::MultiCell($w, $h, $this->convertText($txt), $border, $align, $fill);
    }

    /**
     * Override Write method to handle UTF-8 encoding
     */
    function Write($h, $txt, $link='')
    {
        parent::Write($h, $this->convertText($txt), $link);
    }

    /**
     * Convert UTF-8 text to Windows-1252 encoding
     *
     * @param string $text UTF-8 encoded text
     * @return string Windows-1252 encoded text
     */
    protected function convertText($text)
    {
        if (empty($text)) {
            return '';
        }

        // Serbian Cyrillic and Latin special characters mapping
        $utf8_to_cp1252 = array(
            // Serbian Latin special characters
            'č' => "\x8D",  // U+010D -> CP1252 0x8D
            'Č' => "\x8C",  // U+010C -> CP1252 0x8C
            'ć' => chr(0x9B), // Using available position
            'Ć' => chr(0x8A), // Using available position
            'đ' => chr(0x9E), // Using available position
            'Đ' => chr(0x8E), // Using available position
            'š' => "\x9A",  // U+0161 -> CP1252 0x9A
            'Š' => "\x8A",  // U+0160 -> CP1252 0x8A
            'ž' => "\x9E",  // U+017E -> CP1252 0x9E
            'Ž' => "\x8E",  // U+017D -> CP1252 0x8E

            // Common special characters
            '€' => "\x80",
            '–' => "\x96",  // en dash
            '—' => "\x97",  // em dash
            "\xE2\x80\x9C" => "\x93",  // left double quote (")
            "\xE2\x80\x9D" => "\x94",  // right double quote (")
            "\xE2\x80\x98" => "\x91",  // left single quote (')
            "\xE2\x80\x99" => "\x92",  // right single quote (')
            '…' => "\x85",  // ellipsis
        );

        // First, replace known special characters
        $text = str_replace(array_keys($utf8_to_cp1252), array_values($utf8_to_cp1252), $text);

        // Then try iconv for remaining characters
        if (function_exists('iconv')) {
            $converted = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $text);
            if ($converted !== false) {
                return $converted;
            }
        }

        // Fallback to mb_convert_encoding if available
        if (function_exists('mb_convert_encoding')) {
            $converted = @mb_convert_encoding($text, 'Windows-1252', 'UTF-8');
            if ($converted !== false) {
                return $converted;
            }
        }

        // If all else fails, return the text as-is (will show ? for unsupported chars)
        return $text;
    }

    /**
     * Helper method to set document info with UTF-8 support
     */
    function SetTitle($title, $isUTF8=true)
    {
        if ($isUTF8) {
            $title = $this->convertText($title);
        }
        parent::SetTitle($title);
    }

    /**
     * Helper method to set author with UTF-8 support
     */
    function SetAuthor($author, $isUTF8=true)
    {
        if ($isUTF8) {
            $author = $this->convertText($author);
        }
        parent::SetAuthor($author);
    }

    /**
     * Helper method to set subject with UTF-8 support
     */
    function SetSubject($subject, $isUTF8=true)
    {
        if ($isUTF8) {
            $subject = $this->convertText($subject);
        }
        parent::SetSubject($subject);
    }
}
