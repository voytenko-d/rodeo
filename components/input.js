import Image from "next/image";

export default function Input({
  value,
  placeholder = "0.00",
  position = "left",
  icon = null,
  onMax = null,
  className = "",
  ...rest
}) {
  return (
    <div className="input__container flex">
      {icon ? (
        <div className="input__img flex">
          <Image src={icon} width={20} height={20} alt={"Asset icon"} />
        </div>
      ) : null}
      <input
        className={`input ${className}`}
        style={{
          textAlign: position,
          paddingLeft: icon ? "42px" : null,
          paddingRight: onMax ? "62px" : null,
        }}
        value={value}
        placeholder={placeholder}
        {...rest}
      />
      {onMax ? (
        <button onClick={onMax} className="button input__button-container">
          Max
        </button>
      ) : null}
    </div>
  );
}
