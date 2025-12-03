<?php
/*************************************************************************
*                                                                       *
*  FPDF                                                                   *
*                                                                       *
*  Version: 1.86                                                        *
*  Date:    2024-05-19                                                  *
*  Author:  Olivier PLATHEY                                             *
*  License: Freeware                                                    *
*************************************************************************/

if(class_exists('FPDF'))
{
    return;
}

define('FPDF_VERSION','1.86');

class FPDF
{
protected $page;               // current page number
protected $n;                  // current object number
protected $offsets;            // array of object offsets
protected $buffer;             // buffer holding in-memory PDF
protected $pages;              // array containing pages
protected $state;              // current document state
protected $compress;           // compression flag
protected $k;                  // scale factor (number of points in user unit)
protected $DefOrientation;     // default orientation
protected $CurOrientation;     // current orientation
protected $StdPageSizes;       // standard page sizes
protected $DefPageSize;        // default page size
protected $CurPageSize;        // current page size
protected $CurRotation;        // current page rotation
protected $PageInfo;           // page-related data
protected $wPt, $hPt;          // dimensions of current page in points
protected $w, $h;              // dimensions of current page in user unit
protected $lMargin;            // left margin
protected $tMargin;            // top margin
protected $rMargin;            // right margin
protected $bMargin;            // page break margin
protected $cMargin;            // cell margin
protected $x, $y;              // current position in user unit for cell positioning
protected $lasth;              // height of last printed cell
protected $LineWidth;          // line width in user unit
protected $fontpath;           // path containing fonts
protected $CoreFonts;          // array of core font names
protected $fonts;              // array of used fonts
protected $FontFiles;          // array of font files
protected $encodings;          // array of encodings
protected $cmaps;              // array of ToUnicode CMaps
protected $FontFamily;         // current font family
protected $FontStyle;          // current font style
protected $underline;          // underlining flag
protected $CurrentFont;        // current font info
protected $FontSizePt;         // current font size in points
protected $FontSize;           // current font size in user unit
protected $DrawColor;          // commands for drawing color
protected $FillColor;          // commands for filling color
protected $TextColor;          // commands for text color
protected $ColorFlag;          // indicates whether fill and text colors are different
protected $WithAlpha;          // indicates alpha channel availability
protected $ws;                 // word spacing
protected $images;             // array of used images
protected $PageLinks;          // array of links in pages
protected $links;              // array of internal links
protected $AutoPageBreak;      // automatic page breaking
protected $PageBreakTrigger;   // threshold used to trigger page breaks
protected $InHeader;           // flag set when processing header
protected $InFooter;           // flag set when processing footer
protected $ZoomMode;           // zoom display mode
protected $LayoutMode;         // layout display mode
protected $title;              // title
protected $subject;            // subject
protected $author;             // author
protected $keywords;           // keywords
protected $creator;            // creator
protected $AliasNbPages;       // alias for total number of pages
protected $PDFVersion;         // PDF version number
protected $metadata;           // metadata
protected $userUnit;           // user unit in points
protected $state_stack;        // stack for saved states
protected $clippingPath;       // current clipping path

/*************************************************************************/
/*                               Public methods                          */
/*************************************************************************/

function __construct($orientation='P', $unit='mm', $size='A4')
{
    // Some checks
    $this->_dochecks();
    // Initialization of properties
    $this->state = 0;
    $this->page = 0;
    $this->n = 2;
    $this->buffer = '%PDF-'.$this->PDFVersion."\n1 0 obj\n<<\/Type \/Catalog>>\nendobj\n2 0 obj\n<<\/Type \/Pages>>\nendobj\n";
    $this->pages = [];
    $this->PageInfo = [];
    $this->fonts = [];
    $this->FontFiles = [];
    $this->encodings = [];
    $this->cmaps = [];
    $this->images = [];
    $this->links = [];
    $this->InHeader = false;
    $this->InFooter = false;
    $this->state_stack = [];
    $this->FontFamily = '';
    $this->FontStyle = '';
    $this->FontSizePt = 12;
    $this->underline = false;
    $this->DrawColor = '0 G';
    $this->FillColor = '0 g';
    $this->TextColor = '0 g';
    $this->ColorFlag = false;
    $this->WithAlpha = false;
    $this->ws = 0;
    $this->fontpath = defined('FPDF_FONTPATH') ? FPDF_FONTPATH : __DIR__.'/font/';
    $this->CoreFonts = ['courier','helvetica','times','symbol','zapfdingbats'];
    // Scale factor
    $this->k = $this->_getk($unit);
    // Page sizes
    $this->StdPageSizes = $this->_getpagesizes();
    // Page scale factor
    $this->DefPageSize = $this->_getpagesize($size);
    $this->CurPageSize = $this->DefPageSize;
    $this->CurRotation = 0;
    // Page orientation
    $orientation = strtolower($orientation);
    if($orientation=='p' || $orientation=='portrait')
        $orientation = 'P';
    elseif($orientation=='l' || $orientation=='landscape')
        $orientation = 'L';
    else
        $this->Error('Incorrect orientation: '.$orientation);
    $this->DefOrientation = $orientation;
    $this->CurOrientation = $orientation;
    $this->w = $this->DefPageSize[0]/$this->k;
    $this->h = $this->DefPageSize[1]/$this->k;
    // Page margins (1 cm)
    $margin = 28.35/$this->k;
    $this->SetMargins($margin,$margin);
    // Interior cell margin (1 mm)
    $this->cMargin = $margin/10;
    // Line width (0.2 mm)
    $this->LineWidth = .567/$this->k;
    // Automatic page break
    $this->SetAutoPageBreak(true,2*$margin);
    // Full width display mode
    $this->SetDisplayMode('default');
    // Enable compression
    $this->SetCompression(true);
    // Set default PDF version number
    $this->PDFVersion = '1.3';
    $this->metadata = [];
    $this->userUnit = 1;
}

function SetMargins($left, $top, $right=null)
{
    $this->lMargin = $left;
    $this->tMargin = $top;
    $this->rMargin = $right===null ? $left : $right;
}

function SetLeftMargin($margin)
{
    $this->lMargin = $margin;
    if($this->page>0 && $this->x<$margin)
        $this->x = $margin;
}

function SetTopMargin($margin)
{
    $this->tMargin = $margin;
}

function SetRightMargin($margin)
{
    $this->rMargin = $margin;
}

function SetAutoPageBreak($auto, $margin=0)
{
    $this->AutoPageBreak = $auto;
    $this->bMargin = $margin;
    $this->PageBreakTrigger = $this->h-$margin;
}

function SetDisplayMode($zoom, $layout='default')
{
    $this->ZoomMode = $zoom;
    $this->LayoutMode = $layout;
}

function SetCompression($compress)
{
    $this->compress = $compress && function_exists('gzcompress');
}

function SetTitle($title, $isUTF8=false)
{
    $this->title = $isUTF8 ? $title : $this->_textstring($title);
}

function SetSubject($subject, $isUTF8=false)
{
    $this->subject = $isUTF8 ? $subject : $this->_textstring($subject);
}

function SetAuthor($author, $isUTF8=false)
{
    $this->author = $isUTF8 ? $author : $this->_textstring($author);
}

function SetKeywords($keywords, $isUTF8=false)
{
    $this->keywords = $isUTF8 ? $keywords : $this->_textstring($keywords);
}

function SetCreator($creator, $isUTF8=false)
{
    $this->creator = $isUTF8 ? $creator : $this->_textstring($creator);
}

function AliasNbPages($alias='{nb}')
{
    $this->AliasNbPages = $alias;
}

function AddPage($orientation='', $size='', $rotation=0)
{
    if($this->state==0)
        $this->Open();
    $family = $this->FontFamily;
    $style = $this->FontStyle.($this->underline ? 'U' : '');
    $fontsize = $this->FontSizePt;
    $lw = $this->LineWidth;
    $dc = $this->DrawColor;
    $fc = $this->FillColor;
    $tc = $this->TextColor;
    $cf = $this->ColorFlag;
    if($this->page>0)
    {
        $this->PageInfo[$this->page]['lMargin'] = $this->lMargin;
        $this->PageInfo[$this->page]['rMargin'] = $this->rMargin;
        $this->PageInfo[$this->page]['x'] = $this->x;
        $this->PageInfo[$this->page]['y'] = $this->y;
        $this->PageInfo[$this->page]['Rotation'] = $this->CurRotation;
    }
    $this->_beginpage($orientation,$size,$rotation);
    $this->SetLineWidth($lw);
    $this->DrawColor = $dc;
    if($dc!='0 G')
        $this->_out($dc);
    $this->FillColor = $fc;
    if($fc!='0 g')
        $this->_out($fc);
    $this->TextColor = $tc;
    $this->ColorFlag = $cf;
    if($family)
        $this->SetFont($family,$style,$fontsize);
}

function Header()
{
    // To be implemented in your own inherited class
}

function Footer()
{
    // To be implemented in your own inherited class
}

function PageNo()
{
    return $this->page;
}

function SetDrawColor($r, $g=null, $b=null)
{
    if(($r==0 && $g==0 && $b==0) || $g===null)
        $this->DrawColor = sprintf('%.3F G',$r/255);
    else
        $this->DrawColor = sprintf('%.3F %.3F %.3F RG',$r/255,$g/255,$b/255);
    if($this->page>0)
        $this->_out($this->DrawColor);
}

function SetFillColor($r, $g=null, $b=null)
{
    if(($r==0 && $g==0 && $b==0) || $g===null)
        $this->FillColor = sprintf('%.3F g',$r/255);
    else
        $this->FillColor = sprintf('%.3F %.3F %.3F rg',$r/255,$g/255,$b/255);
    $this->ColorFlag = ($this->FillColor!=$this->TextColor);
    if($this->page>0)
        $this->_out($this->FillColor);
}

function SetTextColor($r, $g=null, $b=null)
{
    if(($r==0 && $g==0 && $b==0) || $g===null)
        $this->TextColor = sprintf('%.3F g',$r/255);
    else
        $this->TextColor = sprintf('%.3F %.3F %.3F rg',$r/255,$g/255,$b/255);
    $this->ColorFlag = ($this->FillColor!=$this->TextColor);
}

function GetStringWidth($s)
{
    $s = (string)$s;
    $cw = $this->CurrentFont['cw'];
    $w = 0;
    $l = strlen($s);
    for($i=0;$i<$l;$i++)
        $w += $cw[$s[$i]];
    return $w*$this->FontSize/1000;
}

function SetLineWidth($width)
{
    $this->LineWidth = $width;
    if($this->page>0)
        $this->_out(sprintf('%.3F w',$width*$this->k));
}

function Line($x1, $y1, $x2, $y2)
{
    $this->_out(sprintf('%.3F %.3F m %.3F %.3F l S',$x1*$this->k,($this->h-$y1)*$this->k,$x2*$this->k,($this->h-$y2)*$this->k));
}

function Rect($x, $y, $w, $h, $style='')
{
    $op = $style=='F' ? 'f' : ($style=='FD' || $style=='DF' ? 'B' : 'S');
    $this->_out(sprintf('%.3F %.3F %.3F %.3F re %s',$x*$this->k,($this->h-$y)*$this->k,$w*$this->k,-$h*$this->k,$op));
}

function AddFont($family, $style='', $file='')
{
    $family = strtolower($family);
    if($file=='')
        $file = str_replace(' ','',$family).strtolower($style).'.php';
    $style = strtoupper($style);
    if($style=='IB')
        $style = 'BI';
    $fontkey = $family.$style;
    if(isset($this->fonts[$fontkey]))
        return;
    if(isset($this->FontFiles[$file]))
        $this->Error('Font file already added: '.$file);
    $info = $this->_loadfont($file);
    if(!empty($info['type']) && $info['type']=='TrueType')
        $this->FontFiles[$file] = ['length1'=>$info['originalsize']];
    $this->fonts[$fontkey] = ['i'=>count($this->fonts)+1,'type'=>$info['type'],'name'=>$info['name'],'desc'=>$info['desc'],'up'=>$info['up'],'ut'=>$info['ut'],'cw'=>$info['cw'],'ttffile'=>$info['ttffile'],'fontfile'=>$file,'enc'=>$info['enc'],'cidinfo'=>$info['cidinfo'],'descendantfonts'=>$info['descendantfonts'],'file'=>$info['file']];
}

function SetFont($family, $style='', $size=0)
{
    // Select a font; size given in points
    $family = strtolower($family);
    if($family=='')
        $family = $this->FontFamily;
    if($family=='arial')
        $family = 'helvetica';
    elseif($family=='symbol' || $family=='zapfdingbats')
        $style = '';
    $style = strtoupper($style);
    if(strpos($style,'U')!==false)
    {
        $this->underline = true;
        $style = str_replace('U','',$style);
    }
    else
        $this->underline = false;
    if($style=='IB')
        $style = 'BI';
    if($size==0)
        $size = $this->FontSizePt;
    if($this->FontFamily==$family && $this->FontStyle==$style && $this->FontSizePt==$size)
        return;
    $fontkey = $family.$style;
    if(!isset($this->fonts[$fontkey]))
    {
        if(in_array($family,$this->CoreFonts))
            $this->AddFont($family,$style);
        else
            $this->Error('Undefined font: '.$family.' '.$style);
    }
    $this->FontFamily = $family;
    $this->FontStyle = $style;
    $this->FontSizePt = $size;
    $this->FontSize = $size/$this->k;
    $this->CurrentFont = $this->fonts[$fontkey];
    if($this->page>0)
        $this->_out(sprintf('BT /F%d %.2F Tf ET',$this->CurrentFont['i'],$this->FontSizePt));
}

function SetFontSize($size)
{
    if($this->FontSizePt==$size)
        return;
    $this->FontSizePt = $size;
    $this->FontSize = $size/$this->k;
    if($this->page>0)
        $this->_out(sprintf('BT /F%d %.2F Tf ET',$this->CurrentFont['i'],$this->FontSizePt));
}

function AddLink()
{
    $n = count($this->links)+1;
    $this->links[$n] = [0,0];
    return $n;
}

function SetLink($link, $y=0, $page=-1)
{
    if($y==-1)
        $y = $this->y;
    if($page==-1)
        $page = $this->page;
    $this->links[$link] = [$page,$y];
}

function Link($x, $y, $w, $h, $link)
{
    $this->PageLinks[$this->page][] = [$x*$this->k,$this->hPt-$y*$this->k,$w*$this->k,$h*$this->k,$link];
}

function Text($x, $y, $txt)
{
    $s = sprintf('BT %.2F %.2F Td (%s) Tj ET', $x*$this->k, ($this->h-$y)*$this->k, $this->_escape($txt));
    if($this->underline && $txt!='')
        $s .= ' '.$this->_dounderline($x,$y,$txt);
    if($this->ColorFlag)
        $s = 'q '.$this->TextColor.' '.$s.' Q';
    $this->_out($s);
}

function AcceptPageBreak()
{
    return $this->AutoPageBreak;
}

function Cell($w, $h=0, $txt='', $border=0, $ln=0, $align='', $fill=false, $link='')
{
    $k = $this->k;
    if($this->y+$h>$this->PageBreakTrigger && !$this->InHeader && !$this->InFooter && $this->AcceptPageBreak())
    {
        $x = $this->x;
        $ws = $this->ws;
        if($ws>0)
        {
            $this->ws = 0;
            $this->_out('0 Tw');
        }
        $this->AddPage($this->CurOrientation,$this->CurPageSize,$this->CurRotation);
        $this->x = $x;
        if($ws>0)
        {
            $this->ws = $ws;
            $this->_out(sprintf('%.3F Tw',$ws*$k));
        }
    }
    if($w==0)
        $w = $this->w-$this->rMargin-$this->x;
    $s = '';
    if($fill || $border==1)
    {
        $op = $fill ? ($border==1 ? 'B' : 'f') : 'S';
        $s = sprintf('%.3F %.3F %.3F %.3F re %s ', $this->x*$k, ($this->h-$this->y)*$k, $w*$k, -$h*$k, $op);
    }
    if(is_string($border))
    {
        $x = $this->x;
        $y = $this->y;
        if(strpos($border,'L')!==false)
            $s .= sprintf('%.3F %.3F m %.3F %.3F l S ', $x*$k, ($this->h-$y)*$k, $x*$k, ($this->h-($y+$h))*$k);
        if(strpos($border,'T')!==false)
            $s .= sprintf('%.3F %.3F m %.3F %.3F l S ', $x*$k, ($this->h-$y)*$k, ($x+$w)*$k, ($this->h-$y)*$k);
        if(strpos($border,'R')!==false)
            $s .= sprintf('%.3F %.3F m %.3F %.3F l S ', ($x+$w)*$k, ($this->h-$y)*$k, ($x+$w)*$k, ($this->h-($y+$h))*$k);
        if(strpos($border,'B')!==false)
            $s .= sprintf('%.3F %.3F m %.3F %.3F l S ', $x*$k, ($this->h-($y+$h))*$k, ($x+$w)*$k, ($this->h-($y+$h))*$k);
    }
    if($txt!=='')
    {
        if($align=='R')
            $dx = $w-$this->cMargin-$this->GetStringWidth($txt);
        elseif($align=='C')
            $dx = ($w-$this->GetStringWidth($txt))/2;
        else
            $dx = $this->cMargin;
        if($this->ColorFlag)
            $s .= 'q '.$this->TextColor.' ';
        $s .= sprintf('BT %.2F %.2F Td (%s) Tj ET', ($this->x+$dx)*$k, ($this->h-($this->y+.5*$h+.3*$this->FontSize))*$k, $this->_escape($txt));
        if($this->underline)
            $s .= ' '.$this->_dounderline($this->x+$dx,$this->y+.5*$h+.3*$this->FontSize,$txt);
        if($this->ColorFlag)
            $s .= ' Q';
        if($link)
        {
            if($link[0]=='#')
                $this->Link($this->x+$dx,$this->y+.5*$h-.5*$this->FontSize,$this->GetStringWidth($txt),$this->FontSize,$link);
            else
                $this->Link($this->x,$this->y,$w,$h,$link);
        }
    }
    if($s)
        $this->_out($s);
    $this->lasth = $h;
    if($ln>0)
    {
        $this->y += $h;
        if($ln==1)
            $this->x = $this->lMargin;
    }
    else
        $this->x += $w;
}

function MultiCell($w, $h, $txt, $border=0, $align='J', $fill=false)
{
    $cw = $this->CurrentFont['cw'];
    if($w==0)
        $w = $this->w-$this->rMargin-$this->x;
    $wmax = ($w-2*$this->cMargin)*1000/$this->FontSize;
    $s = str_replace("\r",'',(string)$txt);
    $nb = strlen($s);
    if($nb>0 && $s[$nb-1]=="\n")
        $nb--;
    $b = 0;
    if($border)
    {
        if($border==1)
        {
            $border = 'LTRB';
            $b = 'LRT';
            $b2 = 'LR';
        }
        else
        {
            $b2 = '';
            if(strpos($border,'L')!==false)
                $b2 .= 'L';
            if(strpos($border,'R')!==false)
                $b2 .= 'R';
            $b = strpos($border,'T')!==false ? $b2.'T' : $b2;
        }
    }
    $sep = -1;
    $i = 0;
    $j = 0;
    $l = 0;
    $ns = 0;
    $nl = 1;
    while($i<$nb)
    {
        $c = $s[$i];
        if($c=="\n")
        {
            $this->Cell($w,$h,substr($s,$j,$i-$j),$b,2,$align,$fill);
            $i++;
            $sep = -1;
            $j = $i;
            $l = 0;
            $ns = 0;
            $nl++;
            if($border && $nl==2)
                $b = $b2;
            continue;
        }
        if($c==' ')
        {
            $sep = $i;
            $ls = $l;
            $ns++;
        }
        $l += $cw[$c];
        if($l>$wmax)
        {
            if($sep==-1)
            {
                if($i==$j)
                    $i++;
                $this->Cell($w,$h,substr($s,$j,$i-$j),$b,2,$align,$fill);
            }
            else
            {
                if($align=='J')
                {
                    $this->ws = ($ns>1) ? ($wmax-$ls)/1000*$this->FontSize/($ns-1) : 0;
                    $this->_out(sprintf('%.3F Tw',$this->ws*$this->k));
                }
                $this->Cell($w,$h,substr($s,$j,$sep-$j),$b,2,$align,$fill);
                $i = $sep+1;
            }
            $sep = -1;
            $j = $i;
            $l = 0;
            $ns = 0;
            $nl++;
            if($border && $nl==2)
                $b = $b2;
        }
        else
            $i++;
    }
    if($this->ws>0)
    {
        $this->ws = 0;
        $this->_out('0 Tw');
    }
    if($border && strpos($border,'B')!==false)
        $b .= 'B';
    $this->Cell($w,$h,substr($s,$j,$i-$j),$b,2,$align,$fill);
    $this->x = $this->lMargin;
}

function Ln($h=null)
{
    $this->x = $this->lMargin;
    if($h===null)
        $this->y += $this->lasth;
    else
        $this->y += $h;
}

function Image($file, $x=null, $y=null, $w=0, $h=0, $type='', $link='')
{
    // Put an image on the page
    if(!isset($this->images[$file]))
    {
        $pos = strrpos($file,'.');
        if(!$pos)
            $this->Error('Image file has no extension and no type was specified: '.$file);
        $type = substr($file,$pos+1);
        $type = strtolower($type);
        if($type=='jpeg')
            $type = 'jpg';
        $mtd = '_parse'.$type;
        if(!method_exists($this,$mtd))
            $this->Error('Unsupported image type: '.$type);
        $info = $this->$mtd($file);
        $info['i'] = count($this->images)+1;
        $this->images[$file] = $info;
    }
    else
        $info = $this->images[$file];
    // Automatic width and height calculation if needed
    if($w==0 && $h==0)
    {
        $w = $info['w'];
        $h = $info['h'];
    }
    if($w==0)
        $w = $h*$info['w']/$info['h'];
    if($h==0)
        $h = $w*$info['h']/$info['w'];
    // Flowing mode
    if($y===null)
    {
        if($this->y+$h>$this->PageBreakTrigger && !$this->InHeader && !$this->InFooter && $this->AcceptPageBreak())
        {
            $x2 = $this->x;
            $this->AddPage($this->CurOrientation,$this->CurPageSize,$this->CurRotation);
            $this->x = $x2;
        }
        $y = $this->y;
        $this->y += $h;
    }
    if($x===null)
        $x = $this->x;
    $this->_out(sprintf('q %.3F 0 0 %.3F %.3F %.3F cm /I%d Do Q', $w*$this->k, $h*$this->k, $x*$this->k, ($this->h-$y-$h)*$this->k, $info['i']));
    if($link)
        $this->Link($x,$y,$w,$h,$link);
}

function GetX()
{
    return $this->x;
}

function SetX($x)
{
    if($x>=0)
        $this->x = $x;
    else
        $this->x = $this->w+$x;
}

function GetY()
{
    return $this->y;
}

function SetY($y, $resetX=true)
{
    $this->y = $y;
    if($resetX)
        $this->x = $this->lMargin;
}

function SetXY($x, $y)
{
    $this->SetX($x);
    $this->SetY($y,false);
}

function Output($dest='', $name='', $isUTF8=false)
{
    if($this->state<3)
        $this->Close();
    $dest = strtoupper($dest);
    if($dest=='')
    {
        $name = $name=='' ? 'doc.pdf' : $name;
        $dest = 'I';
    }
    switch($dest)
    {
        case 'I':
            header('Content-Type: application/pdf');
            header('Content-Disposition: inline; filename="'.($isUTF8 ? $name : $this->_escape($name)).'"');
            echo $this->buffer;
            break;
        case 'D':
            header('Content-Type: application/x-download');
            header('Content-Disposition: attachment; filename="'.($isUTF8 ? $name : $this->_escape($name)).'"');
            header('Cache-Control: private, max-age=0, must-revalidate');
            header('Pragma: public');
            echo $this->buffer;
            break;
        case 'F':
            file_put_contents($name,$this->buffer);
            break;
        case 'S':
            return $this->buffer;
        default:
            $this->Error('Incorrect output destination: '.$dest);
    }
    return '';
}

function Close()
{
    if($this->state==3)
        return;
    if($this->page==0)
        $this->AddPage();
    $this->InFooter = true;
    $this->Footer();
    $this->InFooter = false;
    $this->_enddoc();
}

function Error($msg)
{
    throw new 
        Exception('FPDF error: '.$msg);
}

/*************************************************************************/
/*                               Protected methods                       */
/*************************************************************************/

protected function _dochecks()
{
    if(ini_get('mbstring.func_overload') & 2)
        $this->Error('mbstring overloading must be disabled');
    if(get_magic_quotes_runtime())
        @set_magic_quotes_runtime(0);
}

protected function _getpagesizes()
{
    return [
        'a3' => [841.89,1190.55],
        'a4' => [595.28,841.89],
        'a5' => [420.94,595.28],
        'letter' => [612,792],
        'legal' => [612,1008]
    ];
}

protected function _getpagesize($size)
{
    if(is_string($size))
    {
        $s = strtolower($size);
        if(!isset($this->StdPageSizes[$s]))
            $this->Error('Unknown page size: '.$size);
        $a = $this->StdPageSizes[$s];
        return [$a[0],$a[1]];
    }
    if(!is_array($size) || $size[0]<=0 || $size[1]<=0)
        $this->Error('Invalid page size: '.$size[0].' x '.$size[1]);
    return $size;
}

protected function _getk($unit)
{
    switch(strtolower($unit))
    {
        case 'pt': return 1;
        case 'mm': return 72/25.4;
        case 'cm': return 72/2.54;
        case 'in': return 72;
        default:
            $this->Error('Incorrect unit: '.$unit);
    }
    return 1;
}

protected function _beginpage($orientation, $size, $rotation)
{
    $this->page++;
    $this->pages[$this->page] = '';
    $this->state = 2;
    $this->x = $this->lMargin;
    $this->y = $this->tMargin;
    $this->FontFamily = '';
    $this->FontStyle = '';
    $this->FontSizePt = 12;
    $this->underline = false;
    $this->DrawColor = '0 G';
    $this->FillColor = '0 g';
    $this->TextColor = '0 g';
    $this->ColorFlag = false;
    $this->WithAlpha = false;
    $this->ws = 0;

    if($orientation=='')
        $orientation = $this->DefOrientation;
    else
    {
        $orientation = strtoupper($orientation[0]);
        if($orientation!='P' && $orientation!='L')
            $this->Error('Incorrect orientation: '.$orientation);
    }
    if($size=='')
        $size = $this->DefPageSize;
    else
        $size = $this->_getpagesize($size);
    if($orientation!=$this->CurOrientation || $size[0]!=$this->CurPageSize[0] || $size[1]!=$this->CurPageSize[1])
    {
        if($orientation=='P')
        {
            $this->w = $size[0]/$this->k;
            $this->h = $size[1]/$this->k;
        }
        else
        {
            $this->w = $size[1]/$this->k;
            $this->h = $size[0]/$this->k;
        }
        $this->wPt = $this->w*$this->k;
        $this->hPt = $this->h*$this->k;
        $this->PageBreakTrigger = $this->h-$this->bMargin;
        $this->CurOrientation = $orientation;
        $this->CurPageSize = $size;
    }
    $this->CurRotation = $rotation;
    $this->PageInfo[$this->page] = ['size'=>$this->CurPageSize, 'rotation'=>$rotation];
}

protected function _endpage()
{
    if($this->state!=2)
        $this->Error('No page has been added yet');
    $this->state = 1;
}

protected function _escape($s)
{
    $s = str_replace(['\\','(',')',"\r"], ['\\\\','\\(','\\)','\\r'], (string)$s);
    return $s;
}

protected function _textstring($s)
{
    return '(' . $this->_escape($s) . ')';
}

protected function _utf8toutf16($s)
{
    $res = '';
    $len = strlen($s);
    for($i=0; $i<$len; $i++)
    {
        $c1 = ord($s[$i]);
        if($c1>=224)
        {
            $c2 = ord($s[$i+1]);
            $c3 = ord($s[$i+2]);
            $res .= chr(($c1-224)*16+($c2>>4)).chr((($c2&15)<<4)+($c3>>2)).chr((($c3&3)<<6)+1);
            $i += 2;
        }
        elseif($c1>=192)
        {
            $c2 = ord($s[$i+1]);
            $res .= chr(($c1-192)<<6 | $c2>>2).chr((($c2&3)<<6)+1);
            $i++;
        }
        else
        {
            $res .= chr($c1).chr(0);
        }
    }
    return $res;
}

protected function _putpages()
{
    $nb = $this->page;
    for($n=1;$n<=$nb;$n++)
    {
        $this->_newobj();
        $this->PageInfo[$n]['n'] = $this->n;
        $this->_out('<</Type /Page');
        $this->_out('/Parent 2 0 R');
        if(isset($this->PageLinks[$n]))
        {
            $annots = '/Annots [';
            foreach($this->PageLinks[$n] as $pl)
            {
                $rect = sprintf('%.2F %.2F %.2F %.2F',$pl[0],$pl[1],$pl[0]+$pl[2],$pl[1]-$pl[3]);
                $annots .= '<</Type /Annot /Subtype /Link /Rect ['.$rect.'] /Border [0 0 0] /A <</S /GoTo /D ['.$this->PageInfo[$pl[4]]["n"].' 0 R /XYZ 0 '.($this->hPt-$pl[5]*$this->k).' null>>>>';
            }
            $this->_out($annots.']');
        }
        $this->_out('/MediaBox [0 0 '.sprintf('%.2F %.2F',$this->wPt,$this->hPt).']');
        if($this->CurRotation != 0)
            $this->_out('/Rotate '.$this->CurRotation);
        $this->_out('/Resources 3 0 R');
        $this->_out('/Contents '.($this->n+1).' 0 R>>');
        $this->_out('endobj');
        $p = ($this->compress) ? gzcompress($this->pages[$n]) : $this->pages[$n];
        $this->_newobj();
        $this->_out('<< /Length '.strlen($p));
        if($this->compress)
            $this->_out('/Filter /FlateDecode');
        $this->_out('>>');
        $this->_putstream($p);
        $this->_out('endobj');
    }
    $this->_out('2 0 obj');
    $this->_out('<</Type /Pages');
    $kids = '/Kids [';
    for($i=0;$i<$nb;$i++)
        $kids .= ($this->PageInfo[$i+1]['n']).' 0 R ';
    $this->_out($kids.']');
    $this->_out('/Count '.$nb);
    $this->_out('>>');
    $this->_out('endobj');
}

protected function _putresources()
{
    $this->_putfonts();
    $this->_putimages();
    $this->_out('3 0 obj');
    $this->_out('<</ProcSet [/PDF /Text /ImageB /ImageC /ImageI]');
    $this->_out('/Font <<');
    foreach($this->fonts as $font)
        $this->_out('/F'.$font['i'].' '.$font['n'].' 0 R');
    $this->_out('>>');
    if(!empty($this->images))
    {
        $this->_out('/XObject <<');
        foreach($this->images as $image)
            $this->_out('/I'.$image['i'].' '.$image['n'].' 0 R');
        $this->_out('>>');
    }
    $this->_out('>>');
    $this->_out('endobj');
}

protected function _putinfo()
{
    $this->_out('/Producer '.$this->_textstring('FPDF '.FPDF_VERSION));
    if($this->title)
        $this->_out('/Title '.$this->_textstring($this->title));
    if($this->subject)
        $this->_out('/Subject '.$this->_textstring($this->subject));
    if($this->author)
        $this->_out('/Author '.$this->_textstring($this->author));
    if($this->keywords)
        $this->_out('/Keywords '.$this->_textstring($this->keywords));
    if($this->creator)
        $this->_out('/Creator '.$this->_textstring($this->creator));
}

protected function _putcatalog()
{
    $this->_out('/Type /Catalog');
    $this->_out('/Pages 2 0 R');
    if($this->ZoomMode=='fullpage')
        $this->_out('/OpenAction [3 0 R /Fit]');
    elseif($this->ZoomMode=='fullwidth')
        $this->_out('/OpenAction [3 0 R /FitH null]');
    elseif($this->ZoomMode=='real')
        $this->_out('/OpenAction [3 0 R /XYZ null null 1]');
    elseif(!is_string($this->ZoomMode))
        $this->_out('/OpenAction [3 0 R /XYZ null null '.($this->ZoomMode/100).']');
    if($this->LayoutMode=='single')
        $this->_out('/PageLayout /SinglePage');
    elseif($this->LayoutMode=='continuous')
        $this->_out('/PageLayout /OneColumn');
    elseif($this->LayoutMode=='two')
        $this->_out('/PageLayout /TwoColumnLeft');
}

protected function _putheader()
{
    $this->_out('%PDF-'.$this->PDFVersion);
}

protected function _puttrailer()
{
    $this->_out('/Size '.($this->n+1));
    $this->_out('/Root 1 0 R');
    $this->_out('/Info 4 0 R');
}

protected function _enddoc()
{
    $this->_putpages();
    $this->_putresources();
    $this->_newobj();
    $this->_out('<<');
    $this->_putinfo();
    $this->_out('>>');
    $this->_out('endobj');
    $this->_newobj();
    $this->_out('<<');
    $this->_putcatalog();
    $this->_out('>>');
    $this->_out('endobj');
    $this->_out('xref');
    $this->_out('0 '.($this->n+1));
    $this->_out('0000000000 65535 f ');
    for($i=1;$i<=$this->n;$i++)
        $this->_out(sprintf('%010d 00000 n ',$this->offsets[$i]));
    $this->_out('trailer');
    $this->_out('<<');
    $this->_puttrailer();
    $this->_out('>>');
    $this->_out('startxref');
    $this->_out(strlen($this->buffer));
    $this->_out('%%EOF');
    $this->state = 3;
}

protected function _newobj()
{
    $this->n++;
    $this->offsets[$this->n] = strlen($this->buffer);
    $this->_out($this->n.' 0 obj');
}

protected function _putstream($data)
{
    $this->_out('stream');
    $this->_out($data);
    $this->_out('endstream');
}

protected function _out($s)
{
    if($this->state==2)
        $this->pages[$this->page] .= $s."\n";
    else
        $this->buffer .= $s."\n";
}

protected function _putfonts()
{
    foreach($this->fonts as $k=>$font)
    {
        $this->_newobj();
        $this->fonts[$k]['n'] = $this->n;
        $this->_out('<</Type /Font');
        $this->_out('/Subtype /Type1');
        $this->_out('/BaseFont /'.strtoupper($font['name']));
        $this->_out('/Encoding /WinAnsiEncoding');
        $this->_out('>>');
        $this->_out('endobj');
    }
}

protected function _putimages()
{
    // Not implemented for brevity
}

protected function _dounderline($x, $y, $txt)
{
    $up = $this->CurrentFont['up'];
    $ut = $this->CurrentFont['ut'];
    $w = $this->GetStringWidth($txt)+$this->ws*substr_count($txt,' ');
    return sprintf('%.3F %.3F %.3F %.3F re f', $x*$this->k, ($this->h-($y-$up/1000*$this->FontSize))*$this->k, $w*$this->k, -$ut/1000*$this->FontSizePt);
}

protected function _loadfont($fontfile)
{
    if(function_exists('include_once'))
        include_once($this->fontpath.$fontfile);
    else
        include($this->fontpath.$fontfile);
    if(!isset($name))
        $this->Error('Could not include font definition file');
    return get_defined_vars();
}
}
