<?php
$dir = sys_get_temp_dir();
$t = tempnam($dir, 'php');
var_dump([
    'sys_temp_dir' => $dir,
    'tempnam' => $t,
    'file_exists' => file_exists($t),
    'is_writable_dir' => is_writable($dir),
    'ini_upload_tmp_dir' => ini_get('upload_tmp_dir'),
    'env_TMP' => getenv('TMP'),
    'env_TEMP' => getenv('TEMP'),
]);
if ($t && file_exists($t)) {
    unlink($t);
}
